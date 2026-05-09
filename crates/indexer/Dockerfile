# syntax=docker/dockerfile:1.7
# Thin runtime image. Cargo build runs locally; this image just wraps
# the prebuilt binary at target/release/gpay-indexer.
#
# Build context: repo root.

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --system --no-create-home --uid 10001 gpay
COPY target/release/gpay-indexer /usr/local/bin/gpay-indexer
USER gpay
ENTRYPOINT ["/usr/local/bin/gpay-indexer"]
