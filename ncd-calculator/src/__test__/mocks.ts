import {CompressionCache} from "@/cache/CompressionCache";

/** In-memory compression cache for worker and service tests. */
export class TestCompressionCache extends CompressionCache {
  public constructor() {
    super(null);
  }
}
