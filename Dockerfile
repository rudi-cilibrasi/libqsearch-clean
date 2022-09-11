FROM ubuntu:22.04
WORKDIR /app

# Install core dependencies
RUN apt update
RUN apt install -y git make g++ cmake build-essential

COPY . ./

