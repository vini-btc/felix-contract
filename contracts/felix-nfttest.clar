;; felixnft-test
;; v1
;; Learn more at https://felixapp.xyz/
;; ---
;;
(define-constant felix 'STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6)
(define-constant fee u20)
(define-constant difficulty u5)
(define-constant nft-contract 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sample-megapont-nft)
(define-constant ticket-price u10)
(define-constant number-of-tickets u5)
(define-constant start-block-height (+ block-height u10))
(define-constant end-block-height (+ start-block-height u100))
(define-constant end-cooldown u6)
(define-non-fungible-token felix-test uint)

(define-constant contract-principal (as-contract tx-sender))

(begin
    (try! (contract-call? nft-contract transfer u1 tx-sender contract-principal))
    (ok true))