export interface FieldMapping {
    dbField: string;
    type:
        | 'string'
        | 'text'
        | 'number'
        | 'smallint'
        | 'bigint'
        | 'float'
        | 'double'
        | 'money'
        | 'boolean'
        | 'date'
        | 'timestamp'
        | 'uuid'
        | 'json'
        | 'jsonb'
        | 'array'
        | 'bytea'
        | 'xml'
        | 'inet'
        | 'tsvector'
        | 'interval';
    required?: boolean;
    default?: any;
    validate?: (value: any) => boolean;
    enumValues?: any[];
}

export class FieldValidator {
    private fieldMappings: Map<string, FieldMapping>;

    constructor(fieldMappings: Map<string, FieldMapping>) {
        this.fieldMappings = fieldMappings;
    }

    validateFields(fields: string[]): string[] {
        if (!fields || fields.length === 0) {
            return Array.from(this.fieldMappings.values()).map(f => f.dbField);
        }

        const dbFields = fields
            .map(field => this.fieldMappings.get(field)?.dbField)
            .filter((dbField): dbField is string => Boolean(dbField));

        if (dbFields.length === 0) {
            throw new Error("No valid fields specified for selection");
        }

        const idField = this.fieldMappings.get('id')?.dbField;
        if (idField && !dbFields.includes(idField) && !dbFields.includes('*')) {
            dbFields.push(idField);
        }

        return dbFields;
    }

    validateSortField(sortField: string | null): string | null {
        if (!sortField) return null;

        const mapping = this.fieldMappings.get(sortField);
        if (!mapping) {
            throw new Error(`Invalid sort field: ${sortField}`);
        }

        if (mapping.dbField.includes('CASE') || mapping.dbField.includes('SELECT')) {
            throw new Error(`Cannot sort by computed field: ${sortField}`);
        }

        return mapping.dbField;
    }
} 