(define-constant err-block-not-found (err u404))

(define-read-only (get-rnd (block uint))
  (ok (buff-to-uint-be (unwrap-panic (as-max-len? (unwrap-panic (slice? (unwrap! (get-block-info? vrf-seed block) err-block-not-found) u16 u32)) u16)))))

(define-read-only (tenure-height) block-height)