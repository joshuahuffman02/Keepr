import { RedactingLogger } from "../redacting.logger";

describe("RedactingLogger", () => {
  let logger: RedactingLogger;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => {
    logger = new RedactingLogger();
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it("redacts email, phone, and card last4 in message strings", () => {
    logger.log('Contact john.doe@example.com at +1 (555) 123-4567, last4:"4242"');
    expect(console.log).toHaveBeenCalledWith(
      'Contact [redacted_email] at [redacted_phone], last4:"[redacted_last4]"',
    );
  });

  it("redacts PII inside structured objects", () => {
    const payload = {
      email: "a@b.com",
      phone: "+44 7700 900123",
      payment: { last4: "9999" },
    };

    logger.warn("payload", payload);

    expect(console.warn).toHaveBeenCalledWith("payload", {
      email: "[redacted_email]",
      phone: "[redacted_phone]",
      payment: { last4: "[redacted_last4]" },
    });
  });
});
