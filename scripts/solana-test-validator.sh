#!/bin/bash

rm -rf ./test-ledger

WHIRLPOOL="--bpf-program whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc ./cpi-programs/whirlpool.so"
DRIFT="--bpf-program dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH ./cpi-programs/drift.so"

solana-test-validator $WHIRLPOOL $DRIFT
