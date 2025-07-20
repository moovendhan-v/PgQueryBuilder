import { FieldMapping } from './fieldMapping';

export class ResponseMapper {
    private fieldMappings: Map<string, FieldMapping>;

    constructor(fieldMappings: Map<string, FieldMapping>) {
        this.fieldMappings = fieldMappings;
    }

    mapResponse(row: Record<string, any>): Record<string, any> {
        const mapped: Record<string, any> = {};
        
        for (const [camelKey, mapping] of this.fieldMappings) {
            const columnName = this.extractColumnName(mapping.dbField, camelKey);
            
            if (Object.prototype.hasOwnProperty.call(row, columnName)) {
                mapped[camelKey] = row[columnName];
            }
        }
        
        return mapped;
    }

    mapResponses(rows: Record<string, any>[]): Record<string, any>[] {
        return rows.map(row => this.mapResponse(row));
    }

    private extractColumnName(dbField: string, fallback: string): string {
        if (dbField.includes(' AS ')) {
            const match = dbField.match(/AS\s+("?[\w_]+"?)$/i);
            return match ? match[1].replace(/"/g, '') : fallback;
        }
        
        if (dbField.includes('.')) {
            return dbField.split('.').pop()!;
        }
        
        return fallback;
    }
}
