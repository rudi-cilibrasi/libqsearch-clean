import {describe, expect, test, vi} from "vitest";
import {CompressionService} from "../services/CompressionService";
import type {WorkerFactory} from "../services/CompressionService";

class ControlledWorker extends EventTarget {
    readonly terminate = vi.fn();
    readonly postMessage = vi.fn();
}

const serviceWithWorker = (worker: ControlledWorker, timeout: number): CompressionService => {
    const factory: WorkerFactory = vi.fn(async () => worker as unknown as Worker);
    return CompressionService.getInstance(factory, "lzma", timeout);
};

describe("CompressionService worker initialization", () => {
    test("allows a worker to become ready within the configured cold-start window", async () => {
        const worker = new ControlledWorker();
        const service = serviceWithWorker(worker, 100);
        setTimeout(() => worker.dispatchEvent(new MessageEvent("message", {
            data: {type: "ready", message: "ready"},
        })), 20);

        await expect(service.initialize("lzma")).resolves.toBeUndefined();
        expect(service.hasActiveWorker()).toBe(true);
        expect(worker.terminate).not.toHaveBeenCalled();
        service.terminate();
    });

    test("reports a native worker load error immediately and terminates the worker", async () => {
        const worker = new ControlledWorker();
        const service = serviceWithWorker(worker, 1_000);
        setTimeout(() => worker.dispatchEvent(new ErrorEvent("error", {
            message: "module fetch failed",
            cancelable: true,
        })), 0);

        await expect(service.initialize("lzma")).rejects.toThrow(
            "Compression worker failed to start: module fetch failed.",
        );
        expect(worker.terminate).toHaveBeenCalledOnce();
        expect(service.hasActiveWorker()).toBe(false);
    });

    test("uses a readable timeout error and terminates an unresponsive worker", async () => {
        const worker = new ControlledWorker();
        const service = serviceWithWorker(worker, 10);

        await expect(service.initialize("lzma")).rejects.toThrow(
            "Compression worker did not become ready within 1 seconds.",
        );
        expect(worker.terminate).toHaveBeenCalledOnce();
        expect(service.hasActiveWorker()).toBe(false);
    });

    test("reports an undecodable worker response without waiting for the timeout", async () => {
        const worker = new ControlledWorker();
        const service = serviceWithWorker(worker, 1_000);
        setTimeout(() => worker.dispatchEvent(new MessageEvent("messageerror")), 0);

        await expect(service.initialize("lzma")).rejects.toThrow(
            "Compression worker failed to start because its response could not be decoded.",
        );
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    test("terminates a worker that crashes during computation", async () => {
        const worker = new ControlledWorker();
        const service = serviceWithWorker(worker, 100);
        setTimeout(() => worker.dispatchEvent(new MessageEvent("message", {
            data: {type: "ready", message: "ready"},
        })), 0);
        await service.initialize("lzma");

        const computation = service.processContent({
            labels: ["a", "b"],
            contents: ["aaaa", "bbbb"],
            contentKeys: ["a-key", "b-key"],
            cachedSizes: undefined,
            algorithm: "lzma",
        });
        worker.dispatchEvent(new ErrorEvent("error", {
            message: "worker crashed",
            cancelable: true,
        }));

        await expect(computation).rejects.toThrow(
            "Compression worker failed during computation: worker crashed.",
        );
        expect(worker.terminate).toHaveBeenCalledOnce();
        expect(service.hasActiveWorker()).toBe(false);
    });
});
