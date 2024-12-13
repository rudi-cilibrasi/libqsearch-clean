FROM ubuntu:22.04 as cpp-builder
WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    make \
    g++ \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY src /app/src
COPY runtests /app
COPY CMakeLists.txt /app
COPY samples /app/samples
COPY Makefile /app

RUN chmod +x runtests
RUN sed -i 's/mkdir build/mkdir -p build/' runtests || true

RUN mkdir -p build && \
    cd build && \
    cmake .. && \
    make

FROM ubuntu:22.04 as test-runner
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libstdc++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=cpp-builder /app .

CMD ["./runtests", "--unit"]
