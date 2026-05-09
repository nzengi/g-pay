# syntax=docker/dockerfile:1.7
# Thin runtime image. Cargo build runs locally; this image just wraps
# the prebuilt binary at target/release/gpay-relayer.
#
# Build context: repo root.

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --system --no-create-home --uid 10002 gpay
COPY target/release/gpay-relayer /usr/local/bin/gpay-relayer
USER gpay
EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/gpay-relayer"]
