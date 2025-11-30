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
    config.additionalModules.push({
      __init__: ['readOnlyProvider'],
      readOnlyProvider: ['type', class ReadOnlyProvider {
        constructor(eventBus: any, contextPad: any, dragging: any, directEditing: any, palette: any) {
          // Prevent all editing operations by intercepting events
          eventBus.on('element.click', 10000, (event: any) => {
            // Allow selection but prevent editing
            return event;
          });

          // Completely disable dragging
          eventBus.on('element.mousedown', 10000, (event: any) => {
            if (event.originalEvent.button === 0) {
              return false; // Prevent left-click drag
            }
          });

          // Disable all command stack operations
          const commandEvents = [
            'commandStack.shape.create.preExecute',
            'commandStack.shape.delete.preExecute',
            'commandStack.connection.create.preExecute',
            'commandStack.connection.delete.preExecute',
            'commandStack.elements.move.preExecute',
            'commandStack.shape.resize.preExecute',
            'commandStack.element.updateProperties.preExecute',
            'commandStack.connection.updateWaypoints.preExecute'
          ];

          commandEvents.forEach(eventName => {
            eventBus.on(eventName, 10000, () => false);
          });

          // Disable context pad and palette
          contextPad.registerProvider({ getContextPadEntries: () => ({}) });
          palette.registerProvider({ getPaletteEntries: () => ({}) });
        }
      }]
    });
  }

  return config;
}
