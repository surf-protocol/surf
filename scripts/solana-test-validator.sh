#!/bin/bash

rm -rf ./test-ledger

WHIRLPOOL="--bpf-program whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc ./cpi-programs/whirlpool.so"
DRIFT="--bpf-program dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH ./cpi-programs/drift.so"
PYTH="--bpf-program FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH ./cpi-programs/pyth.so"

solana-test-validator $WHIRLPOOL $DRIFT $PYTH
