#[test_only]
module daas_vader::node_registry_tests {
    use daas_vader::node_registry::{Self, NodeRegistry};
    use sui::test_scenario::{Self, Scenario};
    use std::string;

    // Test addresses
    const ADMIN: address = @0xAD;
    const NODE_PROVIDER_1: address = @0xA1;
    const NODE_PROVIDER_2: address = @0xA2;

    #[test]
    fun test_init_registry() {
        let mut scenario = test_scenario::begin(ADMIN);

        // Initialize the registry
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            node_registry::test_init(test_scenario::ctx(&mut scenario));
        };

        // Check that registry was created and shared
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let registry = test_scenario::take_shared<NodeRegistry>(&scenario);

            // Verify initial state
            assert!(node_registry::get_total_nodes(&registry) == 0, 0);
            assert!(node_registry::get_active_nodes(&registry) == 0, 1);

            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_register_node_success() {
        let mut scenario = test_scenario::begin(ADMIN);

        // Initialize registry
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            node_registry::test_init(test_scenario::ctx(&mut scenario));
        };

        // Register a node
        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::register_node(
                &mut registry,
                8,      // cpu_cores
                32,     // memory_gb
                1000,   // storage_gb
                1000,   // bandwidth_mbps
                string::utf8(b"us-west-1"),
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        // Verify node was registered
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let registry = test_scenario::take_shared<NodeRegistry>(&scenario);

            // Check registry counters
            assert!(node_registry::get_total_nodes(&registry) == 1, 0);
            assert!(node_registry::get_active_nodes(&registry) == 1, 1);

            // Check node exists
            assert!(node_registry::node_exists(&registry, NODE_PROVIDER_1), 2);

            // Check node metadata
            let metadata = node_registry::get_node_metadata(&registry, NODE_PROVIDER_1);
            assert!(node_registry::get_cpu_cores(metadata) == 8, 3);
            assert!(node_registry::get_memory_gb(metadata) == 32, 4);
            assert!(node_registry::get_storage_gb(metadata) == 1000, 5);
            assert!(node_registry::get_bandwidth_mbps(metadata) == 1000, 6);
            assert!(node_registry::get_provider_address(metadata) == NODE_PROVIDER_1, 7);
            assert!(node_registry::is_active(metadata), 8);

            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = daas_vader::node_registry::E_NODE_ALREADY_EXISTS)]
    fun test_register_duplicate_node_fails() {
        let mut scenario = test_scenario::begin(ADMIN);

        // Initialize registry
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            node_registry::test_init(test_scenario::ctx(&mut scenario));
        };

        // Register first node
        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::register_node(
                &mut registry,
                8, 32, 1000, 1000,
                string::utf8(b"us-west-1"),
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        // Try to register same provider again (should fail)
        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::register_node(
                &mut registry,
                16, 64, 2000, 2000,
                string::utf8(b"us-east-1"),
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_update_node_success() {
        let mut scenario = test_scenario::begin(ADMIN);

        // Initialize and register node
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            node_registry::test_init(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::register_node(
                &mut registry,
                8, 32, 1000, 1000,
                string::utf8(b"us-west-1"),
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        // Update node specifications
        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::update_node(
                &mut registry,
                16,     // cpu_cores (updated)
                64,     // memory_gb (updated)
                2000,   // storage_gb (updated)
                2000,   // bandwidth_mbps (updated)
                string::utf8(b"us-east-1"), // region (updated)
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        // Verify updates
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            let metadata = node_registry::get_node_metadata(&registry, NODE_PROVIDER_1);

            assert!(node_registry::get_cpu_cores(metadata) == 16, 0);
            assert!(node_registry::get_memory_gb(metadata) == 64, 1);
            assert!(node_registry::get_storage_gb(metadata) == 2000, 2);
            assert!(node_registry::get_bandwidth_mbps(metadata) == 2000, 3);

            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = daas_vader::node_registry::E_NODE_NOT_FOUND)]
    fun test_update_nonexistent_node_fails() {
        let mut scenario = test_scenario::begin(ADMIN);

        // Initialize registry
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            node_registry::test_init(test_scenario::ctx(&mut scenario));
        };

        // Try to update non-existent node
        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::update_node(
                &mut registry,
                16, 64, 2000, 2000,
                string::utf8(b"us-east-1"),
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_update_node_status() {
        let mut scenario = test_scenario::begin(ADMIN);

        // Initialize and register node
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            node_registry::test_init(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::register_node(
                &mut registry,
                8, 32, 1000, 1000,
                string::utf8(b"us-west-1"),
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        // Update status to maintenance
        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::update_node_status(
                &mut registry,
                3, // NODE_STATUS_MAINTENANCE
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        // Verify status change and active node count
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            let metadata = node_registry::get_node_metadata(&registry, NODE_PROVIDER_1);

            assert!(node_registry::is_maintenance(metadata), 0);
            assert!(!node_registry::is_active(metadata), 1);
            assert!(node_registry::get_active_nodes(&registry) == 0, 2); // Should be 0 now
            assert!(node_registry::get_total_nodes(&registry) == 1, 3); // Still 1 total

            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = daas_vader::node_registry::E_INVALID_STATUS)]
    fun test_update_invalid_status_fails() {
        let mut scenario = test_scenario::begin(ADMIN);

        // Initialize and register node
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            node_registry::test_init(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::register_node(
                &mut registry,
                8, 32, 1000, 1000,
                string::utf8(b"us-west-1"),
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        // Try to set invalid status
        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::update_node_status(
                &mut registry,
                5, // Invalid status (should be 1-3)
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_remove_node() {
        let mut scenario = test_scenario::begin(ADMIN);

        // Initialize and register multiple nodes
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            node_registry::test_init(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::register_node(
                &mut registry,
                8, 32, 1000, 1000,
                string::utf8(b"us-west-1"),
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_2);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::register_node(
                &mut registry,
                16, 64, 2000, 2000,
                string::utf8(b"us-east-1"),
                test_scenario::ctx(&mut scenario)
            );
            test_scenario::return_shared(registry);
        };

        // Remove first node
        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::remove_node(&mut registry, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(registry);
        };

        // Verify removal
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            let registry = test_scenario::take_shared<NodeRegistry>(&scenario);

            assert!(!node_registry::node_exists(&registry, NODE_PROVIDER_1), 0);
            assert!(node_registry::node_exists(&registry, NODE_PROVIDER_2), 1);
            assert!(node_registry::get_total_nodes(&registry) == 1, 2);
            assert!(node_registry::get_active_nodes(&registry) == 1, 3);

            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = daas_vader::node_registry::E_NODE_NOT_FOUND)]
    fun test_remove_nonexistent_node_fails() {
        let mut scenario = test_scenario::begin(ADMIN);

        // Initialize registry
        test_scenario::next_tx(&mut scenario, ADMIN);
        {
            node_registry::test_init(test_scenario::ctx(&mut scenario));
        };

        // Try to remove non-existent node
        test_scenario::next_tx(&mut scenario, NODE_PROVIDER_1);
        {
            let mut registry = test_scenario::take_shared<NodeRegistry>(&scenario);
            node_registry::remove_node(&mut registry, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }
}