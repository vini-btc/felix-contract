;; felix-raffle-felix-nft
;; v1
;; Learn more at https://felixapp.xyz/
;; ---
;;
(define-constant felix 'STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6)
(define-constant draw-block (+ block-height u9))
(define-constant entries (list "vini-btc" "muneeb" "aaron" "patrick" "jude" "mitchell" "james" "larry" "josh" "julian"))

(define-data-var winner (optional (string-ascii 40)) none)

(define-constant err-not-at-draw-block (err u400))
(define-constant err-standard-principal-only (err u401))
(define-constant err-unable-to-get-random-seed (err u500))

(define-private (is-standard-principal-call)
    (is-none (get name (unwrap! (principal-destruct? contract-caller) false))))

(define-read-only (get-winner)
    (var-get winner))


(define-public (pick-winner)
    (begin
        (asserts! (is-standard-principal-call) err-standard-principal-only)
        (asserts! (> block-height draw-block) err-not-at-draw-block)
        (let
            ((random-number (unwrap! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.felix-meta-v2 get-rnd draw-block) err-unable-to-get-random-seed))
            (winner-index (mod random-number (len entries)))
            (chosen-winner (element-at? entries winner-index)))
        (var-set winner chosen-winner)
        (ok chosen-winner))))