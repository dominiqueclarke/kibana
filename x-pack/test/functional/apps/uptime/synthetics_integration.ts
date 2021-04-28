/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../ftr_provider_context';
// import { PolicyTestResourceInfo } from '../../services/endpoint_policy';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ({ getPageObjects, getService }: FtrProviderContext) {
  let policyInfo: PolicyTestResourceInfo;
  const defaultMonitorName = 'Sample Synthetics integration';

  const { common, syntheticsIntegration } = getPageObjects(['common', 'syntheticsIntegration']);
  const testSubjects = getService('testSubjects');
  const { syntheticsPolicy: policyTestResources } = getService('uptime');

  describe('When on the Synthetics Integration Policy Details Page', function () {
    this.tags(['ciGroup6']);

    describe('displays custom UI', () => {
      before(async () => {
        await syntheticsIntegration.navigateToPackagePage();
      });

      it('should display policy view', async () => {
        await testSubjects.existOrFail('monitorSettingsSection');
      });

      it('prevent saving when integration name, url/host, or schedule is missing', async () => {
        const saveButton = await syntheticsIntegration.findSaveButton();
        await saveButton.click();

        await testSubjects.missingOrFail('packagePolicyCreateSuccessToast');
      });
    });

    describe('save new policy', () => {
      beforeEach(async () => {
        // await policyTestResources.deletePolicyByName('system-1');
        await syntheticsIntegration.navigateToPackagePage();
      });

      it('allows saving when user enters a valid integration name and url/host', async () => {
        // This test ensures that updates made to the Endpoint Policy are carried all the way through
        // to the generated Agent Policy that is dispatch down to the Elastic Agent.
        const monitorName = `${defaultMonitorName}--http-simple`;
        const policyNameField = await syntheticsIntegration.findPolicyNameField();
        const policyUrlField = await syntheticsIntegration.findPolicyUrlField();
        await policyNameField.clearValue();
        await policyNameField.click();
        await policyNameField.type(monitorName);
        await policyUrlField.clearValue();
        await policyUrlField.click();
        await policyUrlField.type('http://elastic.co');
        await syntheticsIntegration.confirmAndSave();

        await testSubjects.existOrFail('packagePolicyCreateSuccessToast');

        const [agentPolicy] = await policyTestResources.getAgentPolicyList();
        const agentPolicyId = agentPolicy.id;
        const agentFullPolicy = await policyTestResources.getFullAgentPolicy(agentPolicyId);

        expect(agentFullPolicy.inputs).to.eql([
          {
            data_stream: {
              namespace: 'default',
            },
            id: agentFullPolicy.inputs[0].id,
            meta: {
              package: {
                name: 'synthetics',
                version: '0.0.3',
              },
            },
            name: monitorName,
            revision: 1,
            streams: [
              {
                'check.request.method': 'GET',
                data_stream: {
                  dataset: 'http',
                  type: 'synthetics',
                },
                id: `${agentFullPolicy.inputs[0]?.streams[0]?.id}`,
                max_redirects: 0,
                name: monitorName,
                processors: [
                  {
                    add_observer_metadata: {
                      geo: {
                        name: 'Fleet managed',
                      },
                    },
                  },
                ],
                'response.include_body': 'on_error',
                'response.include_headers': true,
                schedule: '@every 3m',
                timeout: '16s',
                type: 'http',
                urls: 'http://elastic.co',
              },
            ],
            type: 'synthetics/http',
            use_output: 'default',
          },
        ]);

        await policyTestResources.deletePolicyByName(monitorName);
      });

      it('allows saving tcp monitor when user enters a valid integration name and host+port', async () => {
        // This test ensures that updates made to the Endpoint Policy are carried all the way through
        // to the generated Agent Policy that is dispatch down to the Elastic Agent.
        const host = 'smtp.gmail.com:587';
        const monitorName = `${defaultMonitorName}--tcp-simple`;
        await syntheticsIntegration.createBasicTCPMonitorDetails(monitorName, host);
        await syntheticsIntegration.confirmAndSave();

        await testSubjects.existOrFail('packagePolicyCreateSuccessToast');

        const [agentPolicy] = await policyTestResources.getAgentPolicyList();
        const agentPolicyId = agentPolicy.id;
        const agentFullPolicy = await policyTestResources.getFullAgentPolicy(agentPolicyId);

        expect(agentFullPolicy.inputs).to.eql([
          {
            data_stream: {
              namespace: 'default',
            },
            id: agentFullPolicy.inputs[0].id,
            meta: {
              package: {
                name: 'synthetics',
                version: '0.0.3',
              },
            },
            name: monitorName,
            revision: 1,
            streams: [
              {
                'check.request.method': 'GET',
                data_stream: {
                  dataset: 'http',
                  type: 'synthetics',
                },
                id: `${agentFullPolicy?.inputs[0]?.streams[0]?.id}`,
                max_redirects: 0,
                name: monitorName,
                processors: [
                  {
                    add_observer_metadata: {
                      geo: {
                        name: 'Fleet managed',
                      },
                    },
                  },
                ],
                'response.include_body': 'on_error',
                'response.include_headers': true,
                schedule: '@every 3m',
                timeout: '16s',
                type: 'http',
                hosts: host,
              },
            ],
            type: 'synthetics/http',
            use_output: 'default',
          },
        ]);
      });
    });

    // describe('and the save button is clicked', () => {
    //   let policyInfo: PolicyTestResourceInfo;

    //   beforeEach(async () => {
    //     policyInfo = await policyTestResources.createPolicy();
    //     await pageObjects.policy.navigateToPolicyDetails(policyInfo.packagePolicy.id);
    //   });

    //   afterEach(async () => {
    //     if (policyInfo) {
    //       await policyInfo.cleanup();
    //     }
    //   });

    //   it('should display success toast on successful save', async () => {
    //     await pageObjects.endpointPageUtils.clickOnEuiCheckbox('policyWindowsEvent_dns');
    //     await pageObjects.policy.confirmAndSave();

    //     await testSubjects.existOrFail('policyDetailsSuccessMessage');
    //     expect(await testSubjects.getVisibleText('policyDetailsSuccessMessage')).to.equal(
    //       `Integration ${policyInfo.packagePolicy.name} has been updated.`
    //     );
    //   });
    //   it('should persist update on the screen', async () => {
    //     await pageObjects.endpointPageUtils.clickOnEuiCheckbox('policyWindowsEvent_process');
    //     await pageObjects.policy.confirmAndSave();

    //     await testSubjects.existOrFail('policyDetailsSuccessMessage');
    //     await pageObjects.endpoint.navigateToEndpointList();
    //     await pageObjects.policy.navigateToPolicyDetails(policyInfo.packagePolicy.id);

    //     expect(await (await testSubjects.find('policyWindowsEvent_process')).isSelected()).to.equal(
    //       false
    //     );
    //   });
    //   it('should have updated policy data in overall Agent Policy', async () => {
    //     // This test ensures that updates made to the Endpoint Policy are carried all the way through
    //     // to the generated Agent Policy that is dispatch down to the Elastic Agent.

    //     await Promise.all([
    //       pageObjects.endpointPageUtils.clickOnEuiCheckbox('policyWindowsEvent_file'),
    //       pageObjects.endpointPageUtils.clickOnEuiCheckbox('policyLinuxEvent_file'),
    //       pageObjects.endpointPageUtils.clickOnEuiCheckbox('policyMacEvent_file'),
    //     ]);

    //     const advancedPolicyButton = await pageObjects.policy.findAdvancedPolicyButton();
    //     await advancedPolicyButton.click();

    //     const advancedPolicyField = await pageObjects.policy.findAdvancedPolicyField();
    //     await advancedPolicyField.clearValue();
    //     await advancedPolicyField.click();
    //     await advancedPolicyField.type('true');
    //     await pageObjects.policy.confirmAndSave();

    //     await testSubjects.existOrFail('policyDetailsSuccessMessage');

    //     const agentFullPolicy = await policyTestResources.getFullAgentPolicy(
    //       policyInfo.agentPolicy.id
    //     );

    //     expect(agentFullPolicy.inputs).to.eql([
    //       {
    //         id: policyInfo.packagePolicy.id,
    //         revision: 2,
    //         data_stream: { namespace: 'default' },
    //         name: 'Protect East Coast',
    //         meta: {
    //           package: {
    //             name: 'endpoint',
    //             version: policyInfo.packageInfo.version,
    //           },
    //         },
    //         artifact_manifest: {
    //           artifacts: {
    //             'endpoint-exceptionlist-macos-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-exceptionlist-macos-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-exceptionlist-windows-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-exceptionlist-windows-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-trustlist-linux-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-trustlist-linux-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-trustlist-macos-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-trustlist-macos-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-trustlist-windows-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-trustlist-windows-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //           },
    //           // The manifest version could have changed when the Policy was updated because the
    //           // policy details page ensures that a save action applies the udpated policy on top
    //           // of the latest Package Policy. So we just ignore the check against this value by
    //           // forcing it to be the same as the value returned in the full agent policy.
    //           manifest_version: agentFullPolicy.inputs[0].artifact_manifest.manifest_version,
    //           schema_version: 'v1',
    //         },
    //         policy: {
    //           linux: {
    //             events: { file: false, network: true, process: true },
    //             logging: { file: 'info' },
    //             advanced: { agent: { connection_delay: 'true' } },
    //           },
    //           mac: {
    //             events: { file: false, network: true, process: true },
    //             logging: { file: 'info' },
    //             malware: { mode: 'prevent' },
    //             popup: {
    //               malware: {
    //                 enabled: true,
    //                 message: 'Elastic Security {action} {filename}',
    //               },
    //             },
    //           },
    //           windows: {
    //             events: {
    //               dll_and_driver_load: true,
    //               dns: true,
    //               file: false,
    //               network: true,
    //               process: true,
    //               registry: true,
    //               security: true,
    //             },
    //             logging: { file: 'info' },
    //             malware: { mode: 'prevent' },
    //             ransomware: { mode: 'prevent' },
    //             popup: {
    //               malware: {
    //                 enabled: true,
    //                 message: 'Elastic Security {action} {filename}',
    //               },
    //               ransomware: {
    //                 enabled: true,
    //                 message: 'Elastic Security {action} {filename}',
    //               },
    //             },
    //             antivirus_registration: {
    //               enabled: false,
    //             },
    //           },
    //         },
    //         type: 'endpoint',
    //         use_output: 'default',
    //       },
    //     ]);
    //   });

    //   it('should have cleared the advanced section when the user deletes the value', async () => {
    //     const advancedPolicyButton = await pageObjects.policy.findAdvancedPolicyButton();
    //     await advancedPolicyButton.click();

    //     const advancedPolicyField = await pageObjects.policy.findAdvancedPolicyField();
    //     await advancedPolicyField.clearValue();
    //     await advancedPolicyField.click();
    //     await advancedPolicyField.type('true');
    //     await pageObjects.policy.confirmAndSave();

    //     await testSubjects.existOrFail('policyDetailsSuccessMessage');

    //     const agentFullPolicy = await policyTestResources.getFullAgentPolicy(
    //       policyInfo.agentPolicy.id
    //     );

    //     expect(agentFullPolicy.inputs).to.eql([
    //       {
    //         id: policyInfo.packagePolicy.id,
    //         revision: 2,
    //         data_stream: { namespace: 'default' },
    //         name: 'Protect East Coast',
    //         meta: {
    //           package: {
    //             name: 'endpoint',
    //             version: policyInfo.packageInfo.version,
    //           },
    //         },
    //         artifact_manifest: {
    //           artifacts: {
    //             'endpoint-exceptionlist-macos-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-exceptionlist-macos-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-exceptionlist-windows-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-exceptionlist-windows-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-trustlist-linux-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-trustlist-linux-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-trustlist-macos-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-trustlist-macos-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-trustlist-windows-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-trustlist-windows-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //           },
    //           // The manifest version could have changed when the Policy was updated because the
    //           // policy details page ensures that a save action applies the udpated policy on top
    //           // of the latest Package Policy. So we just ignore the check against this value by
    //           // forcing it to be the same as the value returned in the full agent policy.
    //           manifest_version: agentFullPolicy.inputs[0].artifact_manifest.manifest_version,
    //           schema_version: 'v1',
    //         },
    //         policy: {
    //           linux: {
    //             events: { file: true, network: true, process: true },
    //             logging: { file: 'info' },
    //             advanced: { agent: { connection_delay: 'true' } },
    //           },
    //           mac: {
    //             events: { file: true, network: true, process: true },
    //             logging: { file: 'info' },
    //             malware: { mode: 'prevent' },
    //             popup: {
    //               malware: {
    //                 enabled: true,
    //                 message: 'Elastic Security {action} {filename}',
    //               },
    //             },
    //           },
    //           windows: {
    //             events: {
    //               dll_and_driver_load: true,
    //               dns: true,
    //               file: true,
    //               network: true,
    //               process: true,
    //               registry: true,
    //               security: true,
    //             },
    //             logging: { file: 'info' },
    //             malware: { mode: 'prevent' },
    //             ransomware: { mode: 'prevent' },
    //             popup: {
    //               malware: {
    //                 enabled: true,
    //                 message: 'Elastic Security {action} {filename}',
    //               },
    //               ransomware: {
    //                 enabled: true,
    //                 message: 'Elastic Security {action} {filename}',
    //               },
    //             },
    //             antivirus_registration: {
    //               enabled: false,
    //             },
    //           },
    //         },
    //         type: 'endpoint',
    //         use_output: 'default',
    //       },
    //     ]);

    //     // Clear the value
    //     await advancedPolicyField.click();
    //     await advancedPolicyField.clearValueWithKeyboard();

    //     // Make sure the toast button closes so the save button on the sticky footer is visible
    //     await (await testSubjects.find('toastCloseButton')).click();
    //     await testSubjects.waitForHidden('toastCloseButton');
    //     await pageObjects.policy.confirmAndSave();

    //     await testSubjects.existOrFail('policyDetailsSuccessMessage');

    //     const agentFullPolicyUpdated = await policyTestResources.getFullAgentPolicy(
    //       policyInfo.agentPolicy.id
    //     );

    //     expect(agentFullPolicyUpdated.inputs).to.eql([
    //       {
    //         id: policyInfo.packagePolicy.id,
    //         revision: 3,
    //         data_stream: { namespace: 'default' },
    //         name: 'Protect East Coast',
    //         meta: {
    //           package: {
    //             name: 'endpoint',
    //             version: policyInfo.packageInfo.version,
    //           },
    //         },
    //         artifact_manifest: {
    //           artifacts: {
    //             'endpoint-exceptionlist-macos-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-exceptionlist-macos-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-exceptionlist-windows-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-exceptionlist-windows-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-trustlist-linux-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-trustlist-linux-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-trustlist-macos-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-trustlist-macos-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //             'endpoint-trustlist-windows-v1': {
    //               compression_algorithm: 'zlib',
    //               decoded_sha256:
    //                 'd801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //               decoded_size: 14,
    //               encoded_sha256:
    //                 'f8e6afa1d5662f5b37f83337af774b5785b5b7f1daee08b7b00c2d6813874cda',
    //               encoded_size: 22,
    //               encryption_algorithm: 'none',
    //               relative_url:
    //                 '/api/fleet/artifacts/endpoint-trustlist-windows-v1/d801aa1fb7ddcc330a5e3173372ea6af4a3d08ec58074478e85aa5603e926658',
    //             },
    //           },
    //           // The manifest version could have changed when the Policy was updated because the
    //           // policy details page ensures that a save action applies the udpated policy on top
    //           // of the latest Package Policy. So we just ignore the check against this value by
    //           // forcing it to be the same as the value returned in the full agent policy.
    //           manifest_version: agentFullPolicy.inputs[0].artifact_manifest.manifest_version,
    //           schema_version: 'v1',
    //         },
    //         policy: {
    //           linux: {
    //             events: { file: true, network: true, process: true },
    //             logging: { file: 'info' },
    //           },
    //           mac: {
    //             events: { file: true, network: true, process: true },
    //             logging: { file: 'info' },
    //             malware: { mode: 'prevent' },
    //             popup: {
    //               malware: {
    //                 enabled: true,
    //                 message: 'Elastic Security {action} {filename}',
    //               },
    //             },
    //           },
    //           windows: {
    //             events: {
    //               dll_and_driver_load: true,
    //               dns: true,
    //               file: true,
    //               network: true,
    //               process: true,
    //               registry: true,
    //               security: true,
    //             },
    //             logging: { file: 'info' },
    //             malware: { mode: 'prevent' },
    //             ransomware: { mode: 'prevent' },
    //             popup: {
    //               malware: {
    //                 enabled: true,
    //                 message: 'Elastic Security {action} {filename}',
    //               },
    //               ransomware: {
    //                 enabled: true,
    //                 message: 'Elastic Security {action} {filename}',
    //               },
    //             },
    //             antivirus_registration: {
    //               enabled: false,
    //             },
    //           },
    //         },
    //         type: 'endpoint',
    //         use_output: 'default',
    //       },
    //     ]);
    //   });
    // });

    // describe('when on Ingest Policy Edit Package Policy page', async () => {
    //   let policyInfo: PolicyTestResourceInfo;
    //   beforeEach(async () => {
    //     // Create a policy and navigate to Ingest app
    //     policyInfo = await policyTestResources.createPolicy();
    //     await pageObjects.ingestManagerCreatePackagePolicy.navigateToAgentPolicyEditPackagePolicy(
    //       policyInfo.agentPolicy.id,
    //       policyInfo.packagePolicy.id
    //     );
    //   });
    //   afterEach(async () => {
    //     if (policyInfo) {
    //       await policyInfo.cleanup();
    //     }
    //   });

    //   it('should show the endpoint policy form', async () => {
    //     await testSubjects.existOrFail('endpointIntegrationPolicyForm');
    //   });

    //   it('should allow updates to policy items', async () => {
    //     const winDnsEventingCheckbox = await testSubjects.find('policyWindowsEvent_dns');
    //     await pageObjects.ingestManagerCreatePackagePolicy.scrollToCenterOfWindow(
    //       winDnsEventingCheckbox
    //     );
    //     expect(await winDnsEventingCheckbox.isSelected()).to.be(true);
    //     await pageObjects.endpointPageUtils.clickOnEuiCheckbox('policyWindowsEvent_dns');
    //     expect(await winDnsEventingCheckbox.isSelected()).to.be(false);
    //   });

    //   it('should preserve updates done from the Fleet form', async () => {
    //     await pageObjects.ingestManagerCreatePackagePolicy.setPackagePolicyDescription(
    //       'protect everything'
    //     );

    //     const winDnsEventingCheckbox = await testSubjects.find('policyWindowsEvent_dns');
    //     await pageObjects.ingestManagerCreatePackagePolicy.scrollToCenterOfWindow(
    //       winDnsEventingCheckbox
    //     );
    //     await pageObjects.endpointPageUtils.clickOnEuiCheckbox('policyWindowsEvent_dns');

    //     expect(
    //       await pageObjects.ingestManagerCreatePackagePolicy.getPackagePolicyDescriptionValue()
    //     ).to.be('protect everything');
    //   });

    //   it('should include updated endpoint data when saved', async () => {
    //     const winDnsEventingCheckbox = await testSubjects.find('policyWindowsEvent_dns');
    //     await pageObjects.ingestManagerCreatePackagePolicy.scrollToCenterOfWindow(
    //       winDnsEventingCheckbox
    //     );
    //     await pageObjects.endpointPageUtils.clickOnEuiCheckbox('policyWindowsEvent_dns');
    //     const wasSelected = await winDnsEventingCheckbox.isSelected();
    //     await (await pageObjects.ingestManagerCreatePackagePolicy.findSaveButton(true)).click();
    //     await pageObjects.ingestManagerCreatePackagePolicy.waitForSaveSuccessNotification(true);

    //     await pageObjects.ingestManagerCreatePackagePolicy.navigateToAgentPolicyEditPackagePolicy(
    //       policyInfo.agentPolicy.id,
    //       policyInfo.packagePolicy.id
    //     );
    //     expect(await testSubjects.isSelected('policyWindowsEvent_dns')).to.be(wasSelected);
    //   });
    // });
  });
}
