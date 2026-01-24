"use client";

import Script from "next/script";

interface ThirdPartyAnalyticsProps {
  gaMeasurementId?: string | null;
  metaPixelId?: string | null;
}

/**
 * Loads GA4 and Meta Pixel scripts for campground-specific analytics tracking.
 *
 * - GA4: Google Analytics 4 measurement tracking
 * - Meta Pixel: Facebook/Meta conversion and event tracking
 *
 * Only loads scripts when the corresponding ID is provided.
 * Uses afterInteractive strategy to avoid blocking page render.
 */
export function ThirdPartyAnalytics({ gaMeasurementId, metaPixelId }: ThirdPartyAnalyticsProps) {
  return (
    <>
      {/* Google Analytics 4 */}
      {gaMeasurementId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaMeasurementId}');
            `}
          </Script>
        </>
      )}

      {/* Meta Pixel (Facebook) */}
      {metaPixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
