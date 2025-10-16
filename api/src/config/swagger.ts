import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'KPS Pest Control API',
      version: version,
      description: 'Complete API documentation for KPS Pest Control Management System',
      contact: {
        name: 'KPS Pest Control',
        url: 'https://kpspestcontrol.co.za',
        email: 'mail@ctecg.co.za'
      },
      license: {
        name: 'Proprietary',
        url: 'https://kpspestcontrol.co.za'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001/api',
        description: 'Development server'
      },
      {
        url: 'https://kpspestcontrol.co.za/api',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message description'
            },
            error: {
              type: 'string',
              example: 'Detailed error information'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation successful'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            pco_number: {
              type: 'string',
              example: 'pco12345'
            },
            name: {
              type: 'string',
              example: 'John Doe'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com'
            },
            phone: {
              type: 'string',
              example: '+27123456789'
            },
            role: {
              type: 'string',
              enum: ['admin', 'pco', 'both'],
              example: 'pco'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              example: 'active'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Client: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            company_name: {
              type: 'string',
              example: 'ABC Restaurant'
            },
            address_line1: {
              type: 'string',
              example: '123 Main Street'
            },
            address_line2: {
              type: 'string',
              example: 'Suite 100'
            },
            city: {
              type: 'string',
              example: 'Cape Town'
            },
            state: {
              type: 'string',
              example: 'Western Cape'
            },
            postal_code: {
              type: 'string',
              example: '8001'
            },
            country: {
              type: 'string',
              example: 'South Africa'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              example: 'active'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Report: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            client_id: {
              type: 'integer',
              example: 1
            },
            pco_id: {
              type: 'integer',
              example: 4
            },
            service_date: {
              type: 'string',
              format: 'date',
              example: '2025-10-16'
            },
            report_type: {
              type: 'string',
              enum: ['bait_inspection', 'fumigation', 'multi_purpose'],
              example: 'bait_inspection'
            },
            status: {
              type: 'string',
              enum: ['draft', 'pending', 'approved', 'declined'],
              example: 'pending'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Chemical: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            name: {
              type: 'string',
              example: 'Baygon Cockroach Bait'
            },
            active_ingredients: {
              type: 'string',
              example: 'Fipronil 0.05%'
            },
            usage_type: {
              type: 'string',
              enum: ['bait_inspection', 'fumigation', 'multi_purpose'],
              example: 'bait_inspection'
            },
            quantity_unit: {
              type: 'string',
              example: 'grams'
            },
            safety_information: {
              type: 'string',
              example: 'Keep away from children. Wash hands after use.'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              example: 'active'
            }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            user_id: {
              type: 'integer',
              example: 4
            },
            type: {
              type: 'string',
              enum: ['assignment', 'report_declined', 'report_submitted', 'system_update'],
              example: 'assignment'
            },
            title: {
              type: 'string',
              example: 'New Client Assignment'
            },
            message: {
              type: 'string',
              example: 'You have been assigned to client: ABC Restaurant'
            },
            read_at: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'No token provided'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'User does not have permission to access this resource',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Insufficient permissions'
              }
            }
          }
        },
        NotFoundError: {
          description: 'The specified resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Resource not found'
              }
            }
          }
        },
        ValidationError: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Validation failed',
                error: 'Required fields missing'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and session management'
      },
      {
        name: 'Users',
        description: 'User management operations'
      },
      {
        name: 'Clients',
        description: 'Client management operations'
      },
      {
        name: 'Reports',
        description: 'Report management and submission'
      },
      {
        name: 'Chemicals',
        description: 'Chemical inventory management'
      },
      {
        name: 'Search',
        description: 'Search operations across entities'
      },
      {
        name: 'Notifications',
        description: 'Notification management'
      },
      {
        name: 'Dashboard',
        description: 'Admin dashboard and analytics'
      },
      {
        name: 'Sync',
        description: 'Data synchronization for offline support'
      },
      {
        name: 'Export',
        description: 'Data export functionality'
      }
    ]
  },
  // Path to the API routes files with JSDoc comments
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);
