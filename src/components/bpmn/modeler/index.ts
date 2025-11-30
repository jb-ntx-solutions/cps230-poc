/**
 * Custom BPMN Modules
 * Exports all custom providers and modules for the BPMN modeler
 */

import CustomPaletteProvider from './CustomPaletteProvider';
import CustomContextPadProvider from './CustomContextPadProvider';

// Custom Palette Module
export const customPaletteModule = {
  __init__: ['customPaletteProvider'],
  customPaletteProvider: ['type', CustomPaletteProvider]
};

// Custom Context Pad Module
export const customContextPadModule = {
  __init__: ['customContextPadProvider'],
  customContextPadProvider: ['type', CustomContextPadProvider]
};

// Configuration helper
export function getModelerConfig(userRole: string) {
  const config: any = {
    userRole,
    additionalModules: [
      customPaletteModule,
      customContextPadModule
    ],
    moddleExtensions: {
      custom: {
        name: 'Custom',
        uri: 'http://custom',
        prefix: 'custom',
        xml: {
          tagAlias: 'lowerCase'
        },
        types: [
          {
            name: 'ProcessData',
            superClass: ['Element'],
            properties: [
              { name: 'processId', isAttr: true, type: 'String' },
              { name: 'processName', isAttr: true, type: 'String' },
              { name: 'pmProcessId', isAttr: true, type: 'String' },
              { name: 'processUniqueId', isAttr: true, type: 'String' }
            ]
          }
        ]
      }
    }
  };

  // For basic users, disable all editing modules
  if (userRole === 'user') {
    config.additionalModules = [
      ...config.additionalModules,
      {
        // Disable move, resize, and other interactions
        bendpoints: ['value', null],
        move: ['value', null],
        resize: ['value', null],
        contextPad: ['value', null],
        palette: ['value', null],
        lassoTool: ['value', null],
        handTool: ['value', null],
        globalConnect: ['value', null],
        distributeElements: ['value', null],
        alignElements: ['value', null],
        directEditing: ['value', null],
        labelEditingProvider: ['value', null]
      }
    ];
  }

  return config;
}
