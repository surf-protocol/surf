#!/bin/bash

# Script to run tests one by one in separate clusters
# CLI Args:
#   - `--all` run all tests
#   - `--all --wait` to run all tests
#       - program will wait after each test for the confirmation to start next test
#       - until the confirmation, `solana-test-validator` will not be stopped
#   - no args to run one test chosen from displayed selesction

WHIRLPOOL="--bpf-program whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc ./cpi-programs/whirlpool.so"
DRIFT="--bpf-program dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH ./cpi-programs/drift.so"
PYTH="--bpf-program FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH ./cpi-programs/pyth.so"
SURF="--bpf-program 4wVrbfSHxmhevzPzNfdpmVkJ2jqNRy6RYt4TxcHsnfSo ./target/deploy/surf.so"

test_filenames=(./tests/*.test.ts)

function show_files_selection() {
    for i in ${!test_filenames[@]}; do
        echo "index: $i - test: ${test_filenames[$i]}"
    done

    read -p $'\n'"Type index of the test to run: " TEST_FILENAME_INDEX
}

function run_test() {
    local test_file=$1
    echo $'\n'"Running tests for $test_file"

    rm -rf ./test-ledger
    touch "test-logs/validator.log"

    solana-test-validator $WHIRLPOOL $DRIFT $PYTH $SURF > "test-logs/validator.log" 2>&1 &
    SOLANA_TEST_VALIDATOR_PID=$!

    sleep 8
    
    export TEST_FILES=${test_file} && pnpm exec vitest run --config vitest.config.ts

    if [ -z $TEST_NAME_ARG ]; then
        read -p "Solana-test-validator is running, press any key to exit " exit_key

        kill $SOLANA_TEST_VALIDATOR_PID

        exit 0
    elif [ "$2" = "--wait" ]; then
        read -p $'\n'"Press any key to continue: " cont
    fi

    kill $SOLANA_TEST_VALIDATOR_PID
    SOLANA_TEST_VALIDATOR_PID=""

    sleep 3
}

function run_all_tests() {
    for file in ${test_filenames[@]}; do
        run_test "$file" "$1"
    done
}

trap "kill -- -$$" SIGINT

anchor build -- --features test

rm -rf test-logs
mkdir test-logs

TEST_NAME_ARG=$1
WAIT_ARG=$2

if [ -z $TEST_NAME_ARG ]; then
    show_files_selection
    chosen_filename=${test_filenames[$TEST_FILENAME_INDEX]}
    run_test $chosen_filename
elif [ $TEST_NAME_ARG = "--all" ]; then
    run_all_tests "$WAIT_ARG"
else
    run_test "$TEST_NAME_ARG"
fi
