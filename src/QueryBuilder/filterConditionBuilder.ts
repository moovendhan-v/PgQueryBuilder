import { FieldMapping } from './fieldMapping';
import { FilterOperations, FilterOperation } from './filterOperations';
import { DateFilterUtils } from './dateUtils';

export interface CustomTransformers {
    [key: string]: (value: any) => any;
}

export class FilterConditionBuilder {
    private fieldMappings: Map<string, FieldMapping>;
    private customTransformers: Map<string, (value: any) => any>;
    private conditions: string[];
    private values: any[];
    private paramIndex: number;
    private maxConditions: number;

    constructor(fieldMappings: Map<string, FieldMapping>, customTransformers: Map<string, (value: any) => any> = new Map()) {
        this.fieldMappings = fieldMappings;
        this.customTransformers = customTransformers;
        this.conditions = [];
        this.values = [];
        this.paramIndex = 1;
        this.maxConditions = 50;
    }

    addRequiredConditions(requiredFilters: Record<string, any>): this {
        for (const [field, value] of Object.entries(requiredFilters)) {
            this.addCondition(field, 'eq', value);
        }
        return this;
    }

    addDynamicFilters(queryParams: Record<string, any>, excludeFields: string[] = []): this {
        const groupedFilters: Map<string, { fieldName: string, paramValue: any }[]> = new Map();
        let conditionCount = 0;

        for (const [paramKey, paramValue] of Object.entries(queryParams)) {
            if (conditionCount >= this.maxConditions) {
                throw new Error('Maximum number of filter conditions exceeded');
            }
            if (this.shouldSkipParam(paramKey, paramValue, excludeFields)) {
                continue;
            }

            const operatorMatch = paramKey.match(/^(.+)_([a-zA-Z]+)$/);
            let fieldName: string, operator: string;

            if (operatorMatch) {
                [, fieldName, operator] = operatorMatch;
            } else if (this.fieldMappings.get(paramKey)) {
                fieldName = paramKey;
                operator = this.getDefaultOperator(this.fieldMappings.get(paramKey)!.type);
            } else {
                continue;
            }

            if (!groupedFilters.has(operator)) {
                groupedFilters.set(operator, []);
            }
            groupedFilters.get(operator)!.push({ fieldName, paramValue });
            conditionCount++;
        }

        for (const [operator, filters] of groupedFilters) {
            for (const { fieldName, paramValue } of filters) {
                this.addCondition(fieldName, operator, paramValue);
            }
        }

        return this;
    }

    addCondition(field: string, operator: string, value: any): this {
        const mapping = this.fieldMappings.get(field);
        if (!mapping) {
            throw new Error(`Invalid filter field: ${field}`);
        }

        if (['status', 'createdByUser'].includes(field) || 
            mapping.dbField.includes('CASE') || mapping.dbField.includes('SELECT')) {
            return this;
        }

        const operation = FilterOperations.get(operator);
        const dbField = mapping.dbField;

        this.buildCondition(dbField, operation, value, mapping.type);
        return this;
    }

    private buildCondition(dbField: string, operation: FilterOperation, value: any, fieldType: string): void {
        const transformer = this.customTransformers.get(dbField) || operation.valueTransformer;
        switch (operation.operator) {
            case 'isNull':
            case 'isNotNull':
                this.conditions.push(`${dbField} ${operation.sqlOperator}`);
                break;

            case 'in':
            case 'notIn':
                const inValues = Array.isArray(value) ? value : value.split(',').map((v: string) => v.trim());
                const placeholders = inValues.map(() => `$${this.paramIndex++}`).join(', ');
                this.conditions.push(`${dbField} ${operation.sqlOperator} (${placeholders})`);
                this.values.push(...inValues);
                break;

            case 'between':
            case 'notBetween':
            case 'dateRange':
                const range = operation.operator === 'dateRange' 
                    ? DateFilterUtils.parseDateRange(value)
                    : { start: value.start || value[0], end: value.end || value[1] };
                this.conditions.push(`${dbField} ${operation.sqlOperator} $${this.paramIndex} AND $${this.paramIndex + 1}`);
                this.values.push(range.start, range.end);
                this.paramIndex += 2;
                break;

            case 'monthYear':
                const [year, month] = value.split('-').map(Number);
                const monthRange = DateFilterUtils.getMonthRange(year, month);
                this.conditions.push(`${dbField} BETWEEN $${this.paramIndex} AND $${this.paramIndex + 1}`);
                this.values.push(monthRange.start, monthRange.end);
                this.paramIndex += 2;
                break;

            case 'year':
                const yearRange = DateFilterUtils.getYearRange(parseInt(value));
                this.conditions.push(`${dbField} BETWEEN $${this.paramIndex} AND $${this.paramIndex + 1}`);
                this.values.push(yearRange.start, yearRange.end);
                this.paramIndex += 2;
                break;

            case 'any':
            case 'all':
                const arrayValues = Array.isArray(value) ? value : value.split(',').map((v: string) => v.trim());
                this.conditions.push(`${dbField} ${operation.sqlOperator} ($${this.paramIndex})`);
                this.values.push(arrayValues);
                this.paramIndex++;
                break;

            case 'col':
                const colField = this.fieldMappings.get(value)?.dbField || value;
                this.conditions.push(`${dbField} ${operation.sqlOperator} ${colField}`);
                break;

            case 'jsonContains':
            case 'jsonContained':
                const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
                this.conditions.push(`${dbField} ${operation.sqlOperator} $${this.paramIndex}::jsonb`);
                this.values.push(jsonValue);
                this.paramIndex++;
                break;

            case 'jsonKeyExists':
            case 'jsonAnyKeyExists':
            case 'jsonAllKeysExist':
                const keyValue = Array.isArray(value) ? value : [value];
                this.conditions.push(`${dbField} ${operation.sqlOperator} $${this.paramIndex}`);
                this.values.push(keyValue);
                this.paramIndex++;
                break;

            case 'jsonPath':
                const { jsonPath: jsonPathVal, value: pathValue } = value as { jsonPath: string, value: any };
                this.conditions.push(`${dbField}${operation.sqlOperator} $${this.paramIndex} = $${this.paramIndex + 1}`);
                this.values.push(jsonPathVal, pathValue);
                this.paramIndex += 2;
                break;

            case 'jsonPathText':
                this.conditions.push(`${dbField}${operation.sqlOperator} $${this.paramIndex}::jsonb`);
                this.values.push(value);
                this.paramIndex++;
                break;

            case 'jsonEq':
                const [jsonPathEq, eqValue] = Array.isArray(value) ? value : [value.path, value.value];
                this.conditions.push(`${dbField}${operation.sqlOperator} $${this.paramIndex} = $${this.paramIndex + 1}`);
                this.values.push(jsonPathEq, eqValue);
                this.paramIndex += 2;
                break;

            case 'fts':
            case 'ftsPlain':
            case 'ftsPhrase':
            case 'ftsWeb':
                const tsquery = transformer ? transformer(value) : `'${value}'`;
                this.conditions.push(`${dbField} ${operation.sqlOperator}(${tsquery})`);
                this.values.push(value);
                this.paramIndex++;
                break;

            case 'ciEq':
            case 'ciNe':
                const ciValue = transformer ? transformer(value) : value;
                this.conditions.push(`${dbField} ${operation.sqlOperator} $${this.paramIndex}`);
                this.values.push(ciValue);
                this.paramIndex++;
                break;

            case 'isTrue':
            case 'isFalse':
                this.conditions.push(`${dbField} ${operation.sqlOperator} $${this.paramIndex}`);
                this.values.push(operation.transform(undefined));
                this.paramIndex++;
                break;

            case 'distinctFrom':
            case 'notDistinctFrom':
                this.conditions.push(`${dbField} ${operation.sqlOperator} $${this.paramIndex}`);
                this.values.push(value);
                this.paramIndex++;
                break;

            default:
                const transformedValue = transformer ? transformer(value) : operation.transform(value);
                const castSuffix = this.getCastSuffix(fieldType);
                this.conditions.push(`${dbField}${castSuffix} ${operation.sqlOperator} $${this.paramIndex}`);
                this.values.push(transformedValue);
                this.paramIndex++;
        }
    }

    private shouldSkipParam(paramKey: string, paramValue: any, excludeFields: string[]): boolean {
        return paramValue === undefined || 
               paramValue === null || 
               paramValue === '' ||
               excludeFields.includes(paramKey) ||
               ['limit', 'offset', 'sort', 'sortField', 'fields'].includes(paramKey);
    }

    private getDefaultOperator(fieldType: string): string {
        switch (fieldType) {
            case 'string':
                return 'like';
            case 'boolean':
                return 'isTrue';
            case 'uuid':
            case 'number':
                return 'eq';
            case 'date':
            case 'timestamp':
                return 'dateRange';
            case 'jsonb':
                return 'jsonContains';
            case 'array':
                return 'containsArray';
            case 'tsvector':
                return 'fts';
            default:
                return 'eq';
        }
    }

    private getCastSuffix(fieldType: string): string {
        switch (fieldType) {
            case 'date':
                return '::date';
            case 'timestamp':
                return '::timestamp';
            case 'jsonb':
                return '::jsonb';
            case 'array':
                return '::text[]';
            default:
                return '';
        }
    }

    build(): { text: string, values: any[] } {
        return {
            text: this.conditions.length > 0 ? `WHERE ${this.conditions.join(' AND ')}` : '',
            values: this.values
        };
    }
}