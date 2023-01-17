#!/bin/bash

rm -rf ./test-ledger

solana-test-validator --bpf-program whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc ./cpi-programs/whirlpool.so --bpf-program dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH ./cpi-programs/drift.so
