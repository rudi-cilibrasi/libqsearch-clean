/// <reference lib="webworker" />

import {gzip} from "pako";
import {startNcdCompressionWorker} from "./shared/createNcdCompressionWorker";

declare const self: DedicatedWorkerGlobalScope;

const GZIP_LEVEL = 9;

void startNcdCompressionWorker({
  algorithm: "gzip",
  displayName: "gzip / DEFLATE",
  compress: (data) => gzip(data, {level: GZIP_LEVEL}).byteLength,
}, self);

export type {};
