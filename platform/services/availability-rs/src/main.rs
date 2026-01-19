//! Availability Calculator Rust Service
//!
//! Handles pricing evaluation, availability checking, deposit calculation,
//! and revenue forecasting for Campreserv.

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
use tracing::{field, Instrument};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

mod availability;
mod config;
mod db;
mod deposits;
mod error;
mod forecasting;
mod pricing;

use config::Config;
use error::Result;

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
        "service": "availability-rs",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn ready() -> HttpResponse {
    health().await
}

// ============================================================================
// Pricing Handlers
// ============================================================================

/// Evaluate pricing for a reservation.
async fn evaluate_pricing(
    body: web::Json<pricing::EvaluatePricingRequest>,
) -> Result<HttpResponse> {
    let result = pricing::evaluate_pricing(&body)?;
    Ok(HttpResponse::Ok().json(result))
}

// ============================================================================
// Availability Handlers
// ============================================================================

/// Check availability request with site data.
#[derive(Debug, serde::Deserialize)]
struct CheckAvailabilityPayload {
    #[serde(flatten)]
    request: availability::CheckAvailabilityRequest,
    /// Sites to check
    sites: Vec<SiteData>,
    /// Existing reservations
    reservations: Vec<ReservationData>,
    /// Maintenance blocks
    maintenance: Vec<MaintenanceData>,
}

#[derive(Debug, serde::Deserialize)]
struct SiteData {
    id: String,
    name: String,
    site_class_id: String,
    base_rate_cents: Option<u32>,
}

#[derive(Debug, serde::Deserialize)]
struct ReservationData {
    site_id: String,
    arrival_date: chrono::NaiveDate,
    departure_date: chrono::NaiveDate,
    status: String,
}

#[derive(Debug, serde::Deserialize)]
struct MaintenanceData {
    site_id: String,
    start_date: chrono::NaiveDate,
    end_date: chrono::NaiveDate,
    reason: String,
}

/// Check site availability.
async fn check_availability(
    body: web::Json<CheckAvailabilityPayload>,
) -> Result<HttpResponse> {
    let payload = body.into_inner();

    // Convert to internal types
    let sites: Vec<availability::SiteInfo> = payload
        .sites
        .iter()
        .map(|s| availability::SiteInfo {
            id: s.id.clone(),
            name: s.name.clone(),
            site_class_id: s.site_class_id.clone(),
            base_rate_cents: s.base_rate_cents,
        })
        .collect();

    let reservations: Vec<availability::ExistingReservation> = payload
        .reservations
        .iter()
        .map(|r| availability::ExistingReservation {
            site_id: r.site_id.clone(),
            arrival_date: r.arrival_date,
            departure_date: r.departure_date,
            status: r.status.clone(),
        })
        .collect();

    let maintenance: Vec<availability::MaintenanceBlock> = payload
        .maintenance
        .iter()
        .map(|m| availability::MaintenanceBlock {
            site_id: m.site_id.clone(),
            start_date: m.start_date,
            end_date: m.end_date,
            reason: m.reason.clone(),
        })
        .collect();

    let result = availability::filter_available_sites(
        &sites,
        payload.request.arrival_date,
        payload.request.departure_date,
        &reservations,
        &maintenance,
    );

    Ok(HttpResponse::Ok().json(result))
}

// ============================================================================
// Deposit Handlers
// ============================================================================

/// Calculate deposit amount.
async fn calculate_deposit(
    body: web::Json<deposits::CalculateDepositRequest>,
) -> Result<HttpResponse> {
    let result = deposits::calculate_deposit(&body)?;
    Ok(HttpResponse::Ok().json(result))
}

// ============================================================================
// Forecasting Handlers
// ============================================================================

/// Generate revenue forecast.
async fn generate_forecast(
    body: web::Json<forecasting::ForecastRequest>,
) -> Result<HttpResponse> {
    let result = forecasting::generate_forecast(&body);
    Ok(HttpResponse::Ok().json(result))
}

// ============================================================================
// Main Entry Point
// ============================================================================

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load configuration
    let config = Config::from_env().expect("Failed to load configuration");

    // Initialize tracing
    init_tracing(&config.rust_log, "keepr-availability");

    tracing::info!("Starting Availability Calculator service");

    let bind_addr = format!("{}:{}", config.host, config.port);
    tracing::info!("Listening on {}", bind_addr);

    // Start HTTP server
    HttpServer::new(move || {
        App::new()
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
            // Pricing
            .route("/api/pricing/evaluate", web::post().to(evaluate_pricing))
            // Availability
            .route("/api/availability/check", web::post().to(check_availability))
            // Deposits
            .route("/api/deposits/calculate", web::post().to(calculate_deposit))
            // Forecasting
            .route("/api/forecasting/generate", web::post().to(generate_forecast))
    })
    .bind(&bind_addr)?
    .run()
    .await
}
