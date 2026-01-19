//! Payment Processor Rust Service
//!
//! A high-performance, type-safe payment processing service for Campreserv.
//! Handles Stripe payments, refunds, and payout reconciliation.

use actix_web::{
    dev::{Service, ServiceRequest},
    http::header::{HeaderName, HeaderValue},
    middleware, web, App, HttpMessage, HttpResponse, HttpServer,
};
use opentelemetry::{
    global,
    propagation::Extractor,
    trace::{TraceContextExt, TracerProvider},
    Context as OtelContext,
    KeyValue,
};
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{propagation::TraceContextPropagator, trace as sdktrace, Resource};
use std::env;
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tracing::{field, Instrument};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

mod config;
mod db;
mod error;
mod payments;
mod reconciliation;
mod stripe;

use config::Config;
use error::{AppError, Result};
use payments::{
    validate_create_payment_intent, CreatePaymentIntentDto, CapturePaymentIntentDto,
    CreateRefundDto, PaymentIntentResponse, CaptureResponse, RefundResponse,
    FeeConfig, calculate_fees,
};
use stripe::{StripeClient, CreateRefundRequest};

/// Application state shared across handlers.
pub struct AppState {
    pub db: sqlx::PgPool,
    pub stripe_client: StripeClient,
    pub config: Config,
    pub default_fee_config: FeeConfig,
}

#[derive(Clone)]
struct RequestContext {
    request_id: String,
    traceparent: Option<String>,
    tracestate: Option<String>,
}

struct HeaderExtractor<'a>(&'a actix_web::http::header::HeaderMap);

impl<'a> Extractor for HeaderExtractor<'a> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|value| value.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.0.keys().map(|key| key.as_str()).collect()
    }
}

fn header_value(req: &ServiceRequest, name: &str) -> Option<String> {
    req.headers().get(name).and_then(|v| v.to_str().ok()).map(|v| v.to_string())
}

fn build_request_context(req: &ServiceRequest) -> RequestContext {
    let request_id = header_value(req, "x-request-id")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("req_{}", Uuid::new_v4()));
    let traceparent = header_value(req, "traceparent");
    let tracestate = header_value(req, "tracestate");
    RequestContext {
        request_id,
        traceparent,
        tracestate,
    }
}

fn parse_traceparent(traceparent: Option<&str>) -> (Option<String>, Option<String>) {
    let value = match traceparent {
        Some(value) => value,
        None => return (None, None),
    };
    let parts: Vec<&str> = value.split('-').collect();
    if parts.len() < 4 {
        return (None, None);
    }
    (Some(parts[1].to_string()), Some(parts[2].to_string()))
}

fn extract_parent_context(req: &ServiceRequest) -> OtelContext {
    global::get_text_map_propagator(|prop| prop.extract(&HeaderExtractor(req.headers())))
}

fn build_tracer(default_service_name: &str) -> Option<sdktrace::Tracer> {
    let otel_enabled = env::var("OTEL_ENABLED").map(|value| value.to_lowercase() == "true").unwrap_or(false)
        || env::var("OTEL_EXPORTER_OTLP_ENDPOINT").is_ok();
    if !otel_enabled {
        return None;
    }

    let endpoint = match env::var("OTEL_EXPORTER_OTLP_ENDPOINT") {
        Ok(value) => value,
        Err(_) => {
            eprintln!("OTEL_ENABLED is set but OTEL_EXPORTER_OTLP_ENDPOINT is missing; skipping OTel.");
            return None;
        }
    };

    let service_name = env::var("OTEL_SERVICE_NAME").unwrap_or_else(|_| default_service_name.to_string());
    global::set_text_map_propagator(TraceContextPropagator::new());
    let provider = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(opentelemetry_otlp::new_exporter().http().with_endpoint(endpoint))
        .with_trace_config(sdktrace::Config::default().with_resource(Resource::new(vec![KeyValue::new("service.name", service_name.clone())])))
        .install_batch(opentelemetry_sdk::runtime::Tokio);

    match provider {
        Ok(provider) => {
            let tracer = provider.tracer(service_name);
            global::set_tracer_provider(provider);
            Some(tracer)
        }
        Err(error) => {
            eprintln!("Failed to initialize OTel tracer: {error}");
            None
        }
    }
}

fn init_tracing(rust_log: &str, default_service_name: &str) {
    let base = tracing_subscriber::registry().with(tracing_subscriber::EnvFilter::new(rust_log));
    let fmt_layer = tracing_subscriber::fmt::layer();

    if let Some(tracer) = build_tracer(default_service_name) {
        let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);
        base.with(fmt_layer).with(otel_layer).init();
    } else {
        base.with(fmt_layer).init();
    }
}

// ============================================================================
// Health Check
// ============================================================================

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "payment-processor-rs",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn ready() -> HttpResponse {
    health().await
}

// ============================================================================
// Payment Intent Handlers
// ============================================================================

/// Create a new payment intent.
async fn create_payment_intent(
    state: web::Data<Arc<AppState>>,
    body: web::Json<CreatePaymentIntentDto>,
) -> Result<HttpResponse> {
    let dto = body.into_inner();

    // Validate the request
    validate_create_payment_intent(&dto)?;

    // Get the connected account's Stripe ID
    let stripe_account = db::get_campground_stripe_account(&state.db, &dto.connected_account_id)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Campground {} not connected to Stripe",
                dto.connected_account_id
            ))
        })?;

    // Calculate fees
    let fee_calc = calculate_fees(dto.amount_cents as u32, &state.default_fee_config);

    // Build metadata
    let metadata = serde_json::json!({
        "campground_id": dto.campground_id,
        "reservation_id": dto.reservation_id,
        "base_amount_cents": fee_calc.base_amount_cents,
        "platform_fee_cents": fee_calc.platform_fee_cents,
    });

    // Create the payment intent
    let request = stripe::CreatePaymentIntentRequest {
        amount: fee_calc.charge_amount_cents as u64,
        currency: dto.currency.to_lowercase(),
        customer: dto.customer_id,
        payment_method: dto.payment_method_id,
        payment_method_types: Some(vec!["card".to_string()]),
        capture_method: dto.capture_method,
        confirm: None,
        description: dto.description,
        metadata: Some(metadata),
        application_fee_amount: Some(fee_calc.application_fee_cents as u64),
        transfer_data: Some(stripe::TransferDataRequest {
            destination: stripe_account.clone(),
        }),
        on_behalf_of: Some(stripe_account),
    };

    let intent = state
        .stripe_client
        .create_payment_intent(&request, None, dto.idempotency_key.as_deref())
        .await?;

    Ok(HttpResponse::Ok().json(PaymentIntentResponse {
        id: intent.id,
        client_secret: intent.client_secret.unwrap_or_default(),
        status: format!("{:?}", intent.status),
        amount_cents: intent.amount,
        currency: intent.currency,
    }))
}

/// Get a payment intent.
async fn get_payment_intent(
    state: web::Data<Arc<AppState>>,
    path: web::Path<String>,
    query: web::Query<OptionalAccountQuery>,
) -> Result<HttpResponse> {
    let payment_intent_id = path.into_inner();

    let intent = state
        .stripe_client
        .get_payment_intent(&payment_intent_id, query.connected_account_id.as_deref())
        .await?;

    Ok(HttpResponse::Ok().json(intent))
}

/// Capture a payment intent.
async fn capture_payment_intent(
    state: web::Data<Arc<AppState>>,
    path: web::Path<String>,
    body: web::Json<CapturePaymentIntentDto>,
) -> Result<HttpResponse> {
    let payment_intent_id = path.into_inner();
    let dto = body.into_inner();

    let intent = state
        .stripe_client
        .capture_payment_intent(
            &payment_intent_id,
            dto.amount_to_capture,
            dto.connected_account_id.as_deref(),
        )
        .await?;

    // Get receipt URL from the charge
    let receipt_url = if let Some(charge_id) = &intent.latest_charge {
        let charge = state
            .stripe_client
            .get_charge(charge_id, dto.connected_account_id.as_deref())
            .await
            .ok();
        charge.and_then(|c| c.receipt_url)
    } else {
        None
    };

    Ok(HttpResponse::Ok().json(CaptureResponse {
        id: intent.id,
        status: format!("{:?}", intent.status),
        amount_captured: intent.amount_received.unwrap_or(intent.amount),
        receipt_url,
    }))
}

/// Create a refund.
async fn create_refund(
    state: web::Data<Arc<AppState>>,
    body: web::Json<CreateRefundDto>,
) -> Result<HttpResponse> {
    let dto = body.into_inner();

    let request = CreateRefundRequest {
        payment_intent: dto.payment_intent_id,
        amount: dto.amount_cents,
        reason: dto.reason,
        metadata: None,
    };

    let refund = state
        .stripe_client
        .create_refund(&request, dto.connected_account_id.as_deref(), dto.idempotency_key.as_deref())
        .await?;

    Ok(HttpResponse::Ok().json(RefundResponse {
        id: refund.id,
        status: refund.status,
        amount_cents: refund.amount,
    }))
}

// ============================================================================
// Webhook Handler
// ============================================================================

/// Handle Stripe webhooks.
async fn handle_webhook(
    state: web::Data<Arc<AppState>>,
    req: actix_web::HttpRequest,
    body: web::Bytes,
) -> Result<HttpResponse> {
    // Get signature header
    let signature = req
        .headers()
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::Validation("Missing Stripe signature".to_string()))?;

    // Verify signature
    stripe::webhook::verify_webhook_signature(
        &body,
        signature,
        &state.config.stripe_webhook_secret,
    )?;

    // Parse event
    let event = stripe::webhook::parse_webhook_event(&body)?;

    tracing::info!(
        event_type = %event.event_type,
        event_id = %event.id,
        "Received webhook event"
    );

    // Handle event types
    match event.event_type.as_str() {
        "payment_intent.succeeded" => {
            let intent: stripe::PaymentIntent = event.get_object()?;
            tracing::info!(
                payment_intent_id = %intent.id,
                amount = intent.amount,
                "Payment succeeded"
            );
            // TODO: Record payment in database if not already recorded
        }
        "payment_intent.payment_failed" => {
            let intent: stripe::PaymentIntent = event.get_object()?;
            tracing::warn!(
                payment_intent_id = %intent.id,
                "Payment failed"
            );
            // TODO: Handle ACH returns
        }
        "charge.refunded" => {
            let charge: stripe::Charge = event.get_object()?;
            tracing::info!(
                charge_id = %charge.id,
                amount_refunded = charge.amount_refunded,
                "Charge refunded"
            );
            // TODO: Record refund
        }
        "payout.paid" | "payout.updated" => {
            let payout: stripe::Payout = event.get_object()?;
            tracing::info!(
                payout_id = %payout.id,
                status = %payout.status,
                "Payout updated"
            );
            // TODO: Trigger reconciliation
        }
        "charge.dispute.created" => {
            let dispute: stripe::Dispute = event.get_object()?;
            tracing::warn!(
                dispute_id = %dispute.id,
                amount = dispute.amount,
                reason = %dispute.reason,
                "Dispute created"
            );
            // TODO: Handle dispute
        }
        _ => {
            tracing::debug!(event_type = %event.event_type, "Unhandled event type");
        }
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({ "received": true })))
}

// ============================================================================
// Fee Calculation Handler
// ============================================================================

#[derive(Debug, serde::Deserialize)]
struct CalculateFeesRequest {
    amount_cents: u32,
    #[serde(flatten)]
    fee_config: Option<FeeConfig>,
}

/// Calculate fees for a given amount.
async fn calculate_fees_handler(
    state: web::Data<Arc<AppState>>,
    body: web::Json<CalculateFeesRequest>,
) -> Result<HttpResponse> {
    let config = body.fee_config.as_ref().unwrap_or(&state.default_fee_config);
    let result = calculate_fees(body.amount_cents, config);

    Ok(HttpResponse::Ok().json(result))
}

// ============================================================================
// Reconciliation Handlers
// ============================================================================

#[derive(Debug, serde::Deserialize)]
struct ProcessPayoutRequest {
    payout_id: String,
    campground_id: String,
    stripe_account_id: String,
}

/// Process a payout for reconciliation.
async fn process_payout(
    state: web::Data<Arc<AppState>>,
    body: web::Json<ProcessPayoutRequest>,
) -> Result<HttpResponse> {
    let service = reconciliation::PayoutReconciliationService::new(state.stripe_client.clone());

    let (record, entries) = service
        .process_payout(&body.payout_id, &body.campground_id, &body.stripe_account_id)
        .await?;

    // Insert ledger entries
    for entry in &entries {
        db::insert_ledger_entry(&state.db, &entry.debit).await?;
        db::insert_ledger_entry(&state.db, &entry.credit).await?;
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "payout": record,
        "entries_created": entries.len() * 2,
    })))
}

#[derive(Debug, serde::Deserialize)]
struct ComputeSummaryRequest {
    payout_id: String,
    campground_id: String,
    stripe_amount_cents: i64,
    payments_cents: i64,
    refunds_cents: i64,
    stripe_fees_cents: i64,
    platform_fees_cents: i64,
    chargebacks_cents: i64,
}

/// Compute reconciliation summary.
async fn compute_summary(
    state: web::Data<Arc<AppState>>,
    body: web::Json<ComputeSummaryRequest>,
) -> Result<HttpResponse> {
    let summary = reconciliation::compute_reconciliation_summary(
        &body.payout_id,
        &body.campground_id,
        body.stripe_amount_cents,
        body.payments_cents,
        body.refunds_cents,
        body.stripe_fees_cents,
        body.platform_fees_cents,
        body.chargebacks_cents,
        state.config.payout_drift_threshold_cents as i64,
    );

    // Check for drift alert
    let alert = reconciliation::create_drift_alert(
        &summary,
        state.config.payout_drift_threshold_cents as i64,
        state.config.payout_drift_threshold_cents as i64 * 10, // Critical = 10x threshold
    );

    if let Some(alert) = &alert {
        tracing::warn!(
            payout_id = %alert.payout_id,
            drift_cents = alert.drift_cents,
            severity = ?alert.severity,
            "Drift detected in reconciliation"
        );

        // TODO: Send alert to webhook
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "summary": summary,
        "alert": alert,
    })))
}

// ============================================================================
// Query Types
// ============================================================================

#[derive(Debug, serde::Deserialize)]
struct OptionalAccountQuery {
    connected_account_id: Option<String>,
}

// ============================================================================
// Main Entry Point
// ============================================================================

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load configuration
    let config = Config::from_env().expect("Failed to load configuration");

    // Initialize tracing
    init_tracing(&config.rust_log, "keepr-payments");

    tracing::info!("Starting Payment Processor service");

    // Create database pool
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .expect("Failed to connect to database");

    tracing::info!("Connected to database");

    // Create Stripe client
    let stripe_client = StripeClient::new(config.stripe_secret_key.clone());

    // Create default fee config
    let default_fee_config = FeeConfig {
        platform_fee_cents: config.platform_fee_cents,
        platform_fee_percent: 0.0,
        platform_fee_mode: payments::FeeMode::Absorb,
        gateway_fee_percent: 2.9,
        gateway_fee_cents: 30,
        gateway_fee_mode: payments::FeeMode::Absorb,
    };

    // Create app state
    let state = Arc::new(AppState {
        db,
        stripe_client,
        config: config.clone(),
        default_fee_config,
    });

    let bind_addr = format!("{}:{}", config.host, config.port);
    tracing::info!("Listening on {}", bind_addr);

    // Start HTTP server
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            .wrap_fn(|req, srv| {
                let context = build_request_context(&req);
                let (trace_id, span_id) = parse_traceparent(context.traceparent.as_deref());
                let tracestate_present = context.tracestate.is_some();
                req.extensions_mut().insert(context.clone());
                let span = tracing::info_span!(
                    "http_request",
                    request_id = %context.request_id,
                    trace_id = field::Empty,
                    span_id = field::Empty,
                    tracestate_present = tracestate_present,
                    method = %req.method(),
                    path = %req.path()
                );
                let parent_context = extract_parent_context(&req);
                if parent_context.span().span_context().is_valid() {
                    span.set_parent(parent_context);
                }
                if let Some(value) = trace_id.as_deref() {
                    span.record("trace_id", value);
                }
                if let Some(value) = span_id.as_deref() {
                    span.record("span_id", value);
                }
                let fut = srv.call(req);
                async move {
                    let mut res = fut.await?;
                    res.headers_mut().insert(
                        HeaderName::from_static("x-request-id"),
                        HeaderValue::from_str(&context.request_id).unwrap(),
                    );
                    Ok(res)
                }
                .instrument(span)
            })
            // Health check
            .route("/health", web::get().to(health))
            .route("/ready", web::get().to(ready))
            // Payment intents
            .route("/api/payments/create-intent", web::post().to(create_payment_intent))
            .route("/api/payments/intents/{id}", web::get().to(get_payment_intent))
            .route("/api/payments/intents/{id}/capture", web::post().to(capture_payment_intent))
            .route("/api/payments/refund", web::post().to(create_refund))
            // Fee calculation
            .route("/api/payments/calculate-fees", web::post().to(calculate_fees_handler))
            // Webhooks
            .route("/api/payments/webhook", web::post().to(handle_webhook))
            // Reconciliation
            .route("/api/reconciliation/process-payout", web::post().to(process_payout))
            .route("/api/reconciliation/compute-summary", web::post().to(compute_summary))
    })
    .bind(&bind_addr)?
    .run()
    .await
}
