/**
 * Contract Testing Framework
 *
 * Provides schema validation and version compatibility testing
 * for agent communication contracts with N-2 backward compatibility policy.
 */

// Version validation
export {
  VersionValidator,
  VersionCompatibilityResult,
  VersionPolicy,
  DEFAULT_VERSION_POLICY
} from './version-validator';

// Contract validation
export {
  ContractValidator,
  AgentContract,
  ContractValidationResult,
  ContractValidationError
} from './contract-validator';

// Agent contracts
export { scaffoldContract } from './contracts/scaffold.contract';
export { validationContract } from './contracts/validation.contract';
export { e2eContract } from './contracts/e2e.contract';
export { integrationContract } from './contracts/integration.contract';
export { deploymentContract } from './contracts/deployment.contract';
