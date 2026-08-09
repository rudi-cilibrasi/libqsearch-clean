import MockAdapter from "axios-mock-adapter";
import axios, {sendRequestToProxy} from "../functions/fetchProxy";

describe("NCBI browser proxy boundary", () => {
  test("performs one browser request and leaves transient retry policy to the backend", async () => {
    const mock = new MockAdapter(axios);
    mock.onPost("http://localhost:3001/api/external/forward").replyOnce(429, {error: "rate limited"});

    await expect(sendRequestToProxy({
      externalUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term=dog",
    })).rejects.toMatchObject({response: {status: 429}});
    expect(mock.history.post).toHaveLength(1);
    mock.restore();
  });

  test("passes the caller's cancellation signal to the HTTP request", async () => {
    const mock = new MockAdapter(axios);
    mock.onPost("http://localhost:3001/api/external/forward").reply(200, {result: {}});
    const controller = new AbortController();

    await sendRequestToProxy(
      {externalUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=nuccore&id=42"},
      {signal: controller.signal},
    );
    expect(mock.history.post[0].signal).toBe(controller.signal);
    mock.restore();
  });
});
