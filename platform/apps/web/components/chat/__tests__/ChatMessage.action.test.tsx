import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatMessage } from "../ChatMessage";
import type { ChatActionRequired, UnifiedChatMessage } from "../types";

describe("ChatMessage action approvals", () => {
  it("renders action summary and triggers approval callback", async () => {
    const actionRequired: ChatActionRequired = {
      type: "confirmation",
      actionId: "action-1",
      title: "Confirm hold",
      description: "Hold site B2 for the requested dates.",
      summary: "Hold site B2 from 2025-01-01 to 2025-01-03.",
      options: [
        { id: "confirm", label: "Confirm", variant: "default" },
        { id: "cancel", label: "Cancel", variant: "outline" },
      ],
    };
    const message: UnifiedChatMessage = {
      id: "msg-1",
      role: "assistant",
      content: "I can place this hold if you approve.",
      actionRequired,
      createdAt: "2025-01-01T00:00:00Z",
    };
    const onActionSelect = vi.fn();
    const user = userEvent.setup();

    render(<ChatMessage {...message} onActionSelect={onActionSelect} />);

    expect(
      screen.getByText("Summary: Hold site B2 from 2025-01-01 to 2025-01-03."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onActionSelect).toHaveBeenCalledWith("action-1", "confirm");
  });
});
