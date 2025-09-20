# Node Registry Contract Testing & Debugging Guide

## 🧪 Testing Setup

### Prerequisites
```bash
# Install Sui CLI (if not already installed)
curl -fLJO https://github.com/MystenLabs/sui/releases/download/testnet-v1.21.0/sui-testnet-v1.21.0-ubuntu-x86_64.tgz
tar -zxf sui-testnet-v1.21.0-ubuntu-x86_64.tgz
sudo mv sui-testnet-v1.21.0-ubuntu-x86_64/sui /usr/local/bin/

# Verify installation
sui --version
```

### Project Structure
```
contracts/
├── Move.toml              # Package configuration
├── sources/
│   ├── node_registry.move # Main contract
│   ├── enclave_registry.move
│   └── seal_access_control.move
└── tests/
    └── node_registry_tests.move # Test cases
```

## 🚀 Running Tests

### 1. Basic Test Commands

```bash
# Navigate to contracts directory
cd /home/nubroo/daas/DAAS-Vader/contracts

# Run all tests
sui move test

# Run specific test module
sui move test --filter node_registry_tests

# Run with verbose output
sui move test -v

# Run with debug output
sui move test --debug
```

### 2. Specific Test Cases

```bash
# Run individual test functions
sui move test --filter test_register_node_success
sui move test --filter test_update_node_status
sui move test --filter test_remove_node

# Run tests that should fail
sui move test --filter test_register_duplicate_node_fails
```

### 3. Debug Mode Testing

```bash
# Enable debug prints in tests
sui move test --debug --filter test_init_registry

# Show gas usage
sui move test --gas-limit 1000000

# Trace execution
sui move test --trace
```

## 🔍 Debugging Techniques

### 1. Using Debug Prints

Add debug statements to your contract:

```move
use std::debug;

public entry fun register_node(
    registry: &mut NodeRegistry,
    cpu_cores: u32,
    // ... other params
) {
    let provider_address = tx_context::sender(ctx);

    // Debug print
    debug::print(&string::utf8(b"Registering node for: "));
    debug::print(&provider_address);

    // ... rest of function
}
```

### 2. Assert Debugging

Add descriptive assertions:

```move
// Instead of just: assert!(condition, E_SOME_ERROR);
// Use descriptive error codes:
assert!(!table::contains(&registry.nodes, provider_address), E_NODE_ALREADY_EXISTS);
```

### 3. Test Scenario Debugging

In tests, use intermediate checks:

```move
#[test]
fun test_detailed_registration() {
    let scenario = create_test_scenario();

    // Check initial state
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let registry = test_scenario::take_shared<NodeRegistry>(&scenario);
        assert!(node_registry::get_total_nodes(&registry) == 0, 0);
        test_scenario::return_shared(registry);
    };

    // Register node with debug
    register_sample_node(&mut scenario, NODE_PROVIDER_1, ...);

    // Check intermediate state
    test_scenario::next_tx(&mut scenario, ADMIN);
    {
        let registry = test_scenario::take_shared<NodeRegistry>(&scenario);
        // Add detailed assertions here
        assert!(node_registry::get_total_nodes(&registry) == 1, 1);
        test_scenario::return_shared(registry);
    };
}
```

## 🐛 Common Issues & Solutions

### 1. Compilation Errors

**Error**: `unbound type`
```bash
# Solution: Check imports and type definitions
use sui::table::{Self, Table};
```

**Error**: `function not found`
```bash
# Solution: Ensure function is public
public fun my_function() { ... }
# or for entry functions:
public entry fun my_entry_function() { ... }
```

### 2. Test Failures

**Error**: `expected_failure` test passes unexpectedly
```move
// Check error codes match exactly:
#[expected_failure(abort_code = 1)] // Must match E_NODE_ALREADY_EXISTS = 1
```

**Error**: Test scenario issues
```move
// Always return shared objects:
test_scenario::return_shared(registry);

// Use correct transaction sender:
test_scenario::next_tx(&mut scenario, CORRECT_SENDER);
```

### 3. Runtime Errors

**Error**: `Object does not exist`
```move
// Ensure objects are properly shared or transferred:
transfer::share_object(registry); // For shared objects
transfer::public_transfer(obj, recipient); // For owned objects
```

## 📊 Testing Scenarios Covered

### ✅ Core Functionality Tests
- [x] Registry initialization
- [x] Node registration (success case)
- [x] Node updates (specs and status)
- [x] Node removal
- [x] Multiple node management

### ✅ Error Handling Tests
- [x] Duplicate registration prevention
- [x] Non-existent node operations
- [x] Invalid status updates
- [x] Unauthorized access attempts

### ✅ State Management Tests
- [x] Counter accuracy (total/active nodes)
- [x] Status transitions
- [x] Metadata persistence
- [x] Getter function verification

## 🔧 Debugging Workflow

### Step 1: Identify the Issue
```bash
# Run tests to see which ones fail
sui move test

# Look at the specific error
sui move test --filter failing_test_name -v
```

### Step 2: Add Debug Information
```move
// Add debug prints at key points
debug::print(&string::utf8(b"Before assertion"));
debug::print(&some_value);
assert!(condition, error_code);
```

### Step 3: Test Incrementally
```bash
# Test smaller components first
sui move test --filter test_init_registry
sui move test --filter test_register_node_success
# Then test complex scenarios
```

### Step 4: Verify Contract Logic
```move
// Add intermediate state checks
let old_count = registry.total_nodes;
// ... perform operation
assert!(registry.total_nodes == old_count + 1, 999);
```

## 📋 Checklist for Debugging

- [ ] All imports are correct
- [ ] Function visibility (public/entry) is appropriate
- [ ] Error codes are unique and match test expectations
- [ ] Shared objects are properly returned in tests
- [ ] Transaction senders match expected addresses
- [ ] State changes are correctly validated
- [ ] Edge cases are covered in tests

## 🎯 Advanced Testing

### Performance Testing
```bash
# Test with gas limits
sui move test --gas-limit 1000000

# Profile specific operations
sui move test --filter expensive_operation --trace
```

### Integration Testing
```move
// Test interactions between modules
#[test]
fun test_cross_module_interaction() {
    // Test node_registry + enclave_registry integration
}
```

### Stress Testing
```move
#[test]
fun test_many_nodes() {
    // Register 100+ nodes and test performance
    let i = 0;
    while (i < 100) {
        register_sample_node(&mut scenario, @0x{i}, ...);
        i = i + 1;
    };
}
```

## 📖 Resources

- [Sui Move Documentation](https://docs.sui.io/learn/programming-with-objects)
- [Move Testing Guide](https://move-language.github.io/move/unit-testing.html)
- [Sui Examples](https://github.com/MystenLabs/sui/tree/main/sui_programmability/examples)