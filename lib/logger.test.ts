import { describe, expect, it } from "vitest";

import type { LogLevel } from "./env";
import { createLogger } from "./logger";

function captureLogger(level: LogLevel) {
  const lines: { level: LogLevel; entry: Record<string, unknown> }[] = [];
  const logger = createLogger({
    level,
    writer: (lineLevel, line) => lines.push({ level: lineLevel, entry: JSON.parse(line) }),
  });
  return { logger, lines };
}

describe("createLogger", () => {
  it("escribe una línea JSON con time, level, event y los campos", () => {
    const { logger, lines } = captureLogger("debug");

    logger.info("receipt_uploaded", { receiptId: "abc" });

    expect(lines).toHaveLength(1);
    expect(lines[0].entry).toMatchObject({
      level: "info",
      event: "receipt_uploaded",
      receiptId: "abc",
    });
    expect(typeof lines[0].entry.time).toBe("string");
  });

  it("descarta los eventos por debajo del nivel configurado", () => {
    const { logger, lines } = captureLogger("warn");

    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");

    expect(lines.map((l) => l.entry.event)).toEqual(["c", "d"]);
  });

  it("los loggers hijos agregan sus bindings a cada línea", () => {
    const { logger, lines } = captureLogger("info");

    logger.child({ requestId: "req-1" }).child({ route: "/x" }).info("ok");

    expect(lines[0].entry).toMatchObject({ requestId: "req-1", route: "/x" });
  });

  it("serializa los Error con nombre, mensaje y causa", () => {
    const { logger, lines } = captureLogger("info");
    const error = new TypeError("falló", { cause: new Error("raíz") });

    logger.error("boom", { error });

    expect(lines[0].entry.error).toMatchObject({
      name: "TypeError",
      message: "falló",
      cause: { name: "Error", message: "raíz" },
    });
  });
});
