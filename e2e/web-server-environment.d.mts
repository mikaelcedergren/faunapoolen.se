type Environment = Readonly<Record<string, string>>;

export const E2E_BUILD_ENVIRONMENT_KEYS: readonly string[];
export const E2E_RELEASE_BUILD_ENVIRONMENT_KEYS: readonly string[];
export const E2E_SERVER_ENVIRONMENT_KEYS: readonly string[];

export function createE2EBuildEnvironment(input: {
  pathValue: string;
  runtimeTemp: string;
}): Environment;

export function createE2EReleaseBuildEnvironment(input: {
  pathValue: string;
  releaseDirectory: string;
  runtimeTemp: string;
}): Environment;

export function createE2EServerEnvironment(input: {
  pathValue: string;
  port: number | string;
  runtimeRoot: string;
  runtimeTemp: string;
}): Environment;
