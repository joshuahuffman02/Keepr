"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useAnalyticsContext } from "@/providers/analytics-provider";

interface TrackedPageProps {
  children: React.ReactNode;
  pageName: string;
  featureArea: string;
  pageTitle?: string;
}

/**
 * Wrapper component that tracks page views and time on page
 */
export function TrackedPage({ children, pageName, featureArea, pageTitle }: TrackedPageProps) {
  const analytics = useAnalyticsContext();
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (hasTrackedRef.current) return;
    hasTrackedRef.current = true;

    analytics.trackPageView({
      page: pageName,
      pageTitle: pageTitle || pageName,
      featureArea,
    });

    return () => {
      analytics.trackPageLeave();
    };
  }, [analytics, pageName, featureArea, pageTitle]);

  return <>{children}</>;
}

interface TrackedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  actionType: string;
  actionTarget?: string;
  metadata?: Record<string, unknown>;
  children: React.ReactNode;
}

/**
 * Button that automatically tracks clicks
 */
export function TrackedButton({
  actionType,
  actionTarget,
  metadata,
  onClick,
  children,
  ...props
}: TrackedButtonProps) {
  const analytics = useAnalyticsContext();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      analytics.trackAction({
        actionType,
        actionTarget,
        metadata,
      });
      onClick?.(e);
    },
    [analytics, actionType, actionTarget, metadata, onClick],
  );

  return (
    <button onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

interface TrackedLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  actionType?: string;
  actionTarget?: string;
  children: React.ReactNode;
}

/**
 * Link that automatically tracks clicks
 */
export function TrackedLink({
  actionType = "link_click",
  actionTarget,
  onClick,
  children,
  href,
  ...props
}: TrackedLinkProps) {
  const analytics = useAnalyticsContext();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      analytics.trackAction({
        actionType,
        actionTarget: actionTarget || href || undefined,
      });
      onClick?.(e);
    },
    [analytics, actionType, actionTarget, href, onClick],
  );

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}

interface TrackedFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  formName: string;
  featureArea?: string;
  children: React.ReactNode;
}

/**
 * Form that tracks submissions and abandonment
 */
export function TrackedForm({
  formName,
  featureArea,
  onSubmit,
  children,
  ...props
}: TrackedFormProps) {
  const analytics = useAnalyticsContext();
  const startTimeRef = useRef(Date.now());
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    startTimeRef.current = Date.now();

    // Track form abandonment on unmount
    return () => {
      if (hasInteractedRef.current) {
        analytics.trackAction({
          actionType: "form_abandon",
          actionTarget: formName,
          metadata: {
            timeSpentSecs: Math.floor((Date.now() - startTimeRef.current) / 1000),
          },
        });
      }
    };
  }, [analytics, formName]);

  const handleInteraction = useCallback(() => {
    hasInteractedRef.current = true;
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      const durationSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);

      analytics.trackAction({
        actionType: "form_submit",
        actionTarget: formName,
        metadata: {
          durationSecs,
          featureArea,
        },
      });

      hasInteractedRef.current = false; // Prevent abandonment tracking after successful submit
      onSubmit?.(e);
    },
    [analytics, formName, featureArea, onSubmit],
  );

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={handleInteraction}
      onChange={handleInteraction}
      {...props}
    >
      {children}
    </form>
  );
}

interface TrackedSearchProps {
  onSearch: (query: string) => void;
  debounceMs?: number;
  placeholder?: string;
  className?: string;
}

/**
 * Search input that tracks queries
 */
export function TrackedSearch({
  onSearch,
  debounceMs = 500,
  placeholder = "Search...",
  className,
}: TrackedSearchProps) {
  const analytics = useAnalyticsContext();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueryRef = useRef("");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        if (query && query !== lastQueryRef.current) {
          lastQueryRef.current = query;
          analytics.trackSearch(query);
          onSearch(query);
        }
      }, debounceMs);
    },
    [analytics, onSearch, debounceMs],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <input type="search" placeholder={placeholder} className={className} onChange={handleChange} />
  );
}

interface TrackedTabsProps {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
}

/**
 * Tabs component that tracks tab switches
 */
export function TrackedTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  tabClassName,
  activeTabClassName,
}: TrackedTabsProps) {
  const analytics = useAnalyticsContext();

  const handleTabChange = useCallback(
    (tabId: string) => {
      analytics.trackAction({
        actionType: "tab_switch",
        actionTarget: tabId,
        metadata: { previousTab: activeTab },
      });
      onTabChange(tabId);
    },
    [analytics, activeTab, onTabChange],
  );

  return (
    <div className={className}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={`${tabClassName} ${tab.id === activeTab ? activeTabClassName : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface TrackedModalProps {
  isOpen: boolean;
  modalName: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Modal wrapper that tracks opens and closes
 */
export function TrackedModal({ isOpen, modalName, onClose, children }: TrackedModalProps) {
  const analytics = useAnalyticsContext();
  const openTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      openTimeRef.current = Date.now();
      analytics.trackAction({
        actionType: "modal_open",
        actionTarget: modalName,
      });
    } else if (openTimeRef.current) {
      const durationSecs = Math.floor((Date.now() - openTimeRef.current) / 1000);
      analytics.trackAction({
        actionType: "modal_close",
        actionTarget: modalName,
        metadata: { durationSecs },
      });
      openTimeRef.current = null;
    }
  }, [isOpen, analytics, modalName]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return <>{children}</>;
}

/**
 * Hook to track component render time
 */
export function useRenderTracking(componentName: string) {
  const analytics = useAnalyticsContext();
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const renderTime = Date.now() - startTimeRef.current;
    if (renderTime > 100) {
      // Only track slow renders
      analytics.trackTiming("render", componentName, renderTime);
    }
  }, [analytics, componentName]);
}

/**
 * Hook to create a tracked click handler
 */
export function useTrackedClick(
  actionType: string,
  actionTarget?: string,
  metadata?: Record<string, unknown>,
) {
  const analytics = useAnalyticsContext();

  return useCallback(
    <T extends (...args: unknown[]) => unknown>(handler?: T) => {
      return (...args: Parameters<T>) => {
        analytics.trackAction({ actionType, actionTarget, metadata });
        return handler?.(...args);
      };
    },
    [analytics, actionType, actionTarget, metadata],
  );
}
