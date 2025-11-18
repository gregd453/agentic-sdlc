import { describe, it, expect } from 'vitest';
import { JSONPathMapper, JSONPathError } from './jsonpath-mapper';

describe('JSONPathMapper', () => {
  describe('getValueByPath', () => {
    it('should extract simple property', () => {
      const obj = { name: 'John', age: 30 };
      expect(JSONPathMapper.getValueByPath(obj, 'name')).toBe('John');
    });

    it('should extract nested property with dot notation', () => {
      const obj = { user: { name: 'John', email: 'john@example.com' } };
      expect(JSONPathMapper.getValueByPath(obj, 'user.name')).toBe('John');
    });

    it('should extract deeply nested property', () => {
      const obj = { a: { b: { c: { d: 'value' } } } };
      expect(JSONPathMapper.getValueByPath(obj, 'a.b.c.d')).toBe('value');
    });

    it('should extract array element by index', () => {
      const obj = { items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }] };
      expect(JSONPathMapper.getValueByPath(obj, 'items[0].id')).toBe(1);
      expect(JSONPathMapper.getValueByPath(obj, 'items[1].name')).toBe('Item 2');
    });

    it('should handle root reference', () => {
      const obj = { data: 'value' };
      expect(JSONPathMapper.getValueByPath(obj, '$')).toEqual(obj);
      expect(JSONPathMapper.getValueByPath(obj, 'root')).toEqual(obj);
    });

    it('should return undefined for non-existent path', () => {
      const obj = { user: { name: 'John' } };
      expect(JSONPathMapper.getValueByPath(obj, 'user.email')).toBeUndefined();
      expect(JSONPathMapper.getValueByPath(obj, 'missing.path')).toBeUndefined();
    });

    it('should handle bracket notation', () => {
      const obj = { user: { fullName: 'John Doe' } };
      expect(JSONPathMapper.getValueByPath(obj, 'user[fullName]')).toBe('John Doe');
    });

    it('should return object for empty path', () => {
      const obj = { data: 'value' };
      expect(JSONPathMapper.getValueByPath(obj, '')).toEqual(obj);
    });

    it('should handle complex nested arrays and objects', () => {
      const obj = {
        response: {
          data: {
            items: [
              { id: 1, nested: { value: 'a' } },
              { id: 2, nested: { value: 'b' } }
            ]
          }
        }
      };
      expect(JSONPathMapper.getValueByPath(obj, 'response.data.items[0].nested.value')).toBe('a');
      expect(JSONPathMapper.getValueByPath(obj, 'response.data.items[1].nested.value')).toBe('b');
    });
  });

  describe('setValueByPath', () => {
    it('should set simple property', () => {
      const obj = { name: 'John' };
      const result = JSONPathMapper.setValueByPath(obj, 'name', 'Jane');
      expect(result.name).toBe('Jane');
    });

    it('should set nested property', () => {
      const obj = { user: { name: 'John' } };
      const result = JSONPathMapper.setValueByPath(obj, 'user.name', 'Jane');
      expect(result.user.name).toBe('Jane');
    });

    it('should create missing nested structure', () => {
      const obj = {};
      const result = JSONPathMapper.setValueByPath(obj, 'user.profile.name', 'John');
      expect(result.user.profile.name).toBe('John');
    });

    it('should set array element', () => {
      const obj = { items: [{ id: 1 }, { id: 2 }] };
      const result = JSONPathMapper.setValueByPath(obj, 'items[0].id', 99);
      expect(result.items[0].id).toBe(99);
    });

    it('should not mutate original object', () => {
      const obj = { name: 'John' };
      JSONPathMapper.setValueByPath(obj, 'name', 'Jane');
      expect(obj.name).toBe('John');
    });
  });

  describe('validatePath', () => {
    it('should validate simple path', () => {
      const result = JSONPathMapper.validatePath('user.name');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate path with array access', () => {
      const result = JSONPathMapper.validatePath('items[0].name');
      expect(result.valid).toBe(true);
    });

    it('should reject empty path', () => {
      const result = JSONPathMapper.validatePath('');
      expect(result.valid).toBe(false);
    });

    it('should reject path with invalid characters', () => {
      const result = JSONPathMapper.validatePath('user{name}');
      expect(result.valid).toBe(false);
    });

    it('should reject mismatched brackets', () => {
      const result = JSONPathMapper.validatePath('items[0');
      expect(result.valid).toBe(false);
    });

    it('should reject extra closing brackets', () => {
      const result = JSONPathMapper.validatePath('items[0]]');
      expect(result.valid).toBe(false);
    });
  });

  describe('applyOutputMapping', () => {
    it('should map simple output', () => {
      const stageOutput = { id: 123, name: 'Test', status: WORKFLOW_STATUS.SUCCESS };
      const mapping = {
        item_id: 'id',
        item_name: 'name'
      };
      const result = JSONPathMapper.applyOutputMapping(stageOutput, mapping);
      expect(result).toEqual({ item_id: 123, item_name: 'Test' });
    });

    it('should map nested output', () => {
      const stageOutput = {
        response: {
          user: { id: 1, email: 'test@example.com' },
          status: 'ok'
        }
      };
      const mapping = {
        user_id: 'response.user.id',
        user_email: 'response.user.email',
        response_status: 'response.status'
      };
      const result = JSONPathMapper.applyOutputMapping(stageOutput, mapping);
      expect(result).toEqual({
        user_id: 1,
        user_email: 'test@example.com',
        response_status: 'ok'
      });
    });

    it('should handle missing fields gracefully', () => {
      const stageOutput = { name: 'Test' };
      const mapping = {
        name: 'name',
        missing_id: 'id'
      };
      const result = JSONPathMapper.applyOutputMapping(stageOutput, mapping);
      expect(result.name).toBe('Test');
      expect(result.missing_id).toBeUndefined();
    });

    it('should map array elements', () => {
      const stageOutput = {
        items: [
          { id: 1, value: 'a' },
          { id: 2, value: 'b' }
        ]
      };
      const mapping = {
        first_id: 'items[0].id',
        second_value: 'items[1].value'
      };
      const result = JSONPathMapper.applyOutputMapping(stageOutput, mapping);
      expect(result).toEqual({
        first_id: 1,
        second_value: 'b'
      });
    });
  });
});
