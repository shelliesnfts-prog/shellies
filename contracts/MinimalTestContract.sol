// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MinimalTestContract
 * @dev Ultra-minimal contract to test deployment
 */
contract MinimalTestContract {
    uint256 public testValue;
    
    constructor() {
        testValue = 42;
    }
    
    function getValue() external view returns (uint256) {
        return testValue;
    }
    
    function setValue(uint256 _value) external {
        testValue = _value;
    }
}