use std::time::Instant;

/// Single-threaded token bucket. Wrap in a `Mutex` for concurrent use.
pub struct TokenBucket {
    capacity: f64,
    refill_per_sec: f64,
    tokens: f64,
    last_refill: Instant,
}

impl TokenBucket {
    pub fn new(capacity: u32, refill_per_sec: f64) -> Self {
        Self {
            capacity: capacity as f64,
            refill_per_sec,
            tokens: capacity as f64,
            last_refill: Instant::now(),
        }
    }

    pub fn try_consume(&mut self, n: u32) -> bool {
        self.try_consume_at(n, Instant::now())
    }

    pub fn try_consume_at(&mut self, n: u32, now: Instant) -> bool {
        self.refill(now);
        let cost = n as f64;
        if self.tokens >= cost {
            self.tokens -= cost;
            true
        } else {
            false
        }
    }

    pub fn available(&self) -> f64 {
        self.tokens
    }

    fn refill(&mut self, now: Instant) {
        if now <= self.last_refill {
            return;
        }
        let elapsed = now.duration_since(self.last_refill);
        let added = elapsed.as_secs_f64() * self.refill_per_sec;
        self.tokens = (self.tokens + added).min(self.capacity);
        self.last_refill = now;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn consumes_until_empty() {
        let mut bucket = TokenBucket::new(5, 1.0);
        for _ in 0..5 {
            assert!(bucket.try_consume(1));
        }
        assert!(!bucket.try_consume(1));
    }

    #[test]
    fn refills_with_time() {
        let mut bucket = TokenBucket::new(10, 5.0);
        let start = Instant::now();
        for _ in 0..10 {
            assert!(bucket.try_consume_at(1, start));
        }
        assert!(!bucket.try_consume_at(1, start));

        let later = start + std::time::Duration::from_secs(1);
        for _ in 0..5 {
            assert!(bucket.try_consume_at(1, later));
        }
        assert!(!bucket.try_consume_at(1, later));
    }

    #[test]
    fn burst_capped_at_capacity() {
        let mut bucket = TokenBucket::new(3, 1000.0);
        let start = Instant::now();
        let way_later = start + std::time::Duration::from_secs(60);
        bucket.try_consume_at(0, way_later);
        assert_eq!(bucket.available(), 3.0);
    }
}
