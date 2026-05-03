/**
 * Tests for case transformation utilities.
 * FIX CRIT-API-02: Verify snake_case <-> camelCase conversion.
 */
import { describe, it, expect } from "vitest";
import {
  snakeToCamel,
  camelToSnake,
  toCamelCase,
  toSnakeCase,
  isSnakeCase,
  isCamelCase,
  toCamelCaseSelective,
  toSnakeCaseSelective,
} from "./case-transform";

describe("snakeToCamel", () => {
  it("converts simple snake_case to camelCase", () => {
    expect(snakeToCamel("client_id")).toBe("clientId");
    expect(snakeToCamel("created_at")).toBe("createdAt");
    expect(snakeToCamel("user_name")).toBe("userName");
  });

  it("converts multi-word snake_case", () => {
    expect(snakeToCamel("api_key_secret")).toBe("apiKeySecret");
    expect(snakeToCamel("first_name_last_name")).toBe("firstNameLastName");
  });

  it("handles single words", () => {
    expect(snakeToCamel("id")).toBe("id");
    expect(snakeToCamel("name")).toBe("name");
  });

  it("handles empty string", () => {
    expect(snakeToCamel("")).toBe("");
  });
});

describe("camelToSnake", () => {
  it("converts simple camelCase to snake_case", () => {
    expect(camelToSnake("clientId")).toBe("client_id");
    expect(camelToSnake("createdAt")).toBe("created_at");
    expect(camelToSnake("userName")).toBe("user_name");
  });

  it("converts multi-word camelCase", () => {
    expect(camelToSnake("apiKeySecret")).toBe("api_key_secret");
    expect(camelToSnake("firstNameLastName")).toBe("first_name_last_name");
  });

  it("handles single words", () => {
    expect(camelToSnake("id")).toBe("id");
    expect(camelToSnake("name")).toBe("name");
  });

  it("handles empty string", () => {
    expect(camelToSnake("")).toBe("");
  });
});

describe("isSnakeCase", () => {
  it("returns true for snake_case strings", () => {
    expect(isSnakeCase("client_id")).toBe(true);
    expect(isSnakeCase("api_key_secret")).toBe(true);
    expect(isSnakeCase("name")).toBe(true);
  });

  it("returns false for non-snake_case strings", () => {
    expect(isSnakeCase("clientId")).toBe(false);
    expect(isSnakeCase("Client_id")).toBe(false);
    expect(isSnakeCase("client-id")).toBe(false);
  });
});

describe("isCamelCase", () => {
  it("returns true for camelCase strings", () => {
    expect(isCamelCase("clientId")).toBe(true);
    expect(isCamelCase("apiKeySecret")).toBe(true);
    expect(isCamelCase("name")).toBe(true);
  });

  it("returns false for non-camelCase strings", () => {
    expect(isCamelCase("client_id")).toBe(false);
    expect(isCamelCase("ClientId")).toBe(false);
    expect(isCamelCase("client-id")).toBe(false);
  });
});

describe("toCamelCase", () => {
  it("converts flat object keys from snake_case to camelCase", () => {
    const input = {
      client_id: "123",
      created_at: "2024-01-01",
      user_name: "John",
    };

    const result = toCamelCase(input);

    expect(result).toEqual({
      clientId: "123",
      createdAt: "2024-01-01",
      userName: "John",
    });
  });

  it("converts nested object keys", () => {
    const input = {
      client_data: {
        first_name: "John",
        last_name: "Doe",
        contact_info: {
          email_address: "john@example.com",
        },
      },
    };

    const result = toCamelCase(input);

    expect(result).toEqual({
      clientData: {
        firstName: "John",
        lastName: "Doe",
        contactInfo: {
          emailAddress: "john@example.com",
        },
      },
    });
  });

  it("handles arrays of objects", () => {
    const input = {
      users: [
        { user_id: "1", user_name: "Alice" },
        { user_id: "2", user_name: "Bob" },
      ],
    };

    const result = toCamelCase(input);

    expect(result).toEqual({
      users: [
        { userId: "1", userName: "Alice" },
        { userId: "2", userName: "Bob" },
      ],
    });
  });

  it("handles null and undefined", () => {
    expect(toCamelCase(null)).toBe(null);
    expect(toCamelCase(undefined)).toBe(undefined);
  });

  it("handles primitive values", () => {
    expect(toCamelCase("string")).toBe("string");
    expect(toCamelCase(123)).toBe(123);
    expect(toCamelCase(true)).toBe(true);
  });

  it("handles arrays of primitives", () => {
    const input = { tags: ["tag_one", "tag_two"] };
    const result = toCamelCase(input);
    expect(result).toEqual({ tags: ["tag_one", "tag_two"] });
  });
});

describe("toSnakeCase", () => {
  it("converts flat object keys from camelCase to snake_case", () => {
    const input = {
      clientId: "123",
      createdAt: "2024-01-01",
      userName: "John",
    };

    const result = toSnakeCase(input);

    expect(result).toEqual({
      client_id: "123",
      created_at: "2024-01-01",
      user_name: "John",
    });
  });

  it("converts nested object keys", () => {
    const input = {
      clientData: {
        firstName: "John",
        lastName: "Doe",
        contactInfo: {
          emailAddress: "john@example.com",
        },
      },
    };

    const result = toSnakeCase(input);

    expect(result).toEqual({
      client_data: {
        first_name: "John",
        last_name: "Doe",
        contact_info: {
          email_address: "john@example.com",
        },
      },
    });
  });

  it("handles arrays of objects", () => {
    const input = {
      users: [
        { userId: "1", userName: "Alice" },
        { userId: "2", userName: "Bob" },
      ],
    };

    const result = toSnakeCase(input);

    expect(result).toEqual({
      users: [
        { user_id: "1", user_name: "Alice" },
        { user_id: "2", user_name: "Bob" },
      ],
    });
  });

  it("handles null and undefined", () => {
    expect(toSnakeCase(null)).toBe(null);
    expect(toSnakeCase(undefined)).toBe(undefined);
  });
});

describe("toCamelCaseSelective", () => {
  it("skips specified keys during transformation", () => {
    const input = {
      client_id: "123",
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    };

    const result = toCamelCaseSelective(input);

    expect(result).toEqual({
      clientId: "123",
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    });
  });

  it("uses custom skip keys", () => {
    const input = {
      client_id: "123",
      api_version: "v1",
    };

    const result = toCamelCaseSelective(input, new Set(["api_version"]));

    expect(result).toEqual({
      clientId: "123",
      api_version: "v1",
    });
  });
});

describe("toSnakeCaseSelective", () => {
  it("skips specified keys during transformation", () => {
    const input = {
      clientId: "123",
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    };

    const result = toSnakeCaseSelective(input);

    expect(result).toEqual({
      client_id: "123",
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    });
  });
});

describe("roundtrip conversion", () => {
  it("preserves data through snake -> camel -> snake conversion", () => {
    const original = {
      client_id: "123",
      user_data: {
        first_name: "John",
        items: [{ item_id: "1" }, { item_id: "2" }],
      },
    };

    const camel = toCamelCase(original);
    const backToSnake = toSnakeCase(camel);

    expect(backToSnake).toEqual(original);
  });

  it("preserves data through camel -> snake -> camel conversion", () => {
    const original = {
      clientId: "123",
      userData: {
        firstName: "John",
        items: [{ itemId: "1" }, { itemId: "2" }],
      },
    };

    const snake = toSnakeCase(original);
    const backToCamel = toCamelCase(snake);

    expect(backToCamel).toEqual(original);
  });
});
