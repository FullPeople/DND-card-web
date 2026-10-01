package httpapi

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"dnd-card/backend/internal/character"
	"dnd-card/backend/schemas"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

func TestOpenAPIRoutesAndExamples(t *testing.T) {
	b, e := os.ReadFile("../../../../openapi.yaml")
	if e != nil {
		t.Fatal(e)
	}
	var api map[string]any
	if e = json.Unmarshal(b, &api); e != nil {
		t.Fatal(e)
	}
	h := setupHTTP(t)
	paths := api["paths"].(map[string]any)
	seen := map[string]bool{}
	for _, route := range h.api.Router().Routes() {
		path := strings.ReplaceAll(strings.ReplaceAll(route.Path, ":userId", "{userId}"), ":id", "{id}")
		method := strings.ToLower(route.Method)
		p, ok := paths[path].(map[string]any)
		if !ok || p[method] == nil {
			t.Fatalf("undocumented route %s %s", method, path)
		}
		seen[method+" "+path] = true
	}
	for path, methods := range paths {
		for method := range methods.(map[string]any) {
			if !seen[method+" "+path] {
				t.Fatalf("unimplemented route %s %s", method, path)
			}
		}
	}
	c := jsonschema.NewCompiler()
	if e = c.AddResource("api.json", api); e != nil {
		t.Fatal(e)
	}
	// Validate every generated API request/response example against its declared schema.
	for path, methods := range paths {
		for method, op := range methods.(map[string]any) {
			o := op.(map[string]any)
			media := []map[string]any{}
			if body, ok := o["requestBody"].(map[string]any); ok {
				media = append(media, body["content"].(map[string]any)["application/json"].(map[string]any))
			}
			for _, response := range o["responses"].(map[string]any) {
				if content, ok := response.(map[string]any)["content"].(map[string]any); ok {
					media = append(media, content["application/json"].(map[string]any))
				}
			}
			for _, m := range media {
				example, ok := m["example"]
				if !ok {
					continue
				}
				raw := m["schema"].(map[string]any)
				schemaRef, ok := raw["$ref"].(string)
				if !ok {
					continue
				}
				s, e := c.Compile("api.json" + schemaRef)
				if e != nil {
					t.Fatal(e)
				}
				if e = s.Validate(example); e != nil {
					t.Fatalf("%s %s: %v", method, path, e)
				}
			}
		}
	}
	v, e := character.NewValidator(4 << 20)
	if e != nil {
		t.Fatal(e)
	}
	b, e = os.ReadFile("../../../examples/character.json")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = v.Migrate(b); e != nil {
		t.Fatal(e)
	}
	// The embedded schema and OpenAPI operation contract must be identical.
	b, e = schemas.Files.ReadFile("protocol/operation.v1.json")
	if e != nil {
		t.Fatal(e)
	}
	var operation map[string]any
	json.Unmarshal(b, &operation)
	delete(operation, "$id")
	delete(operation, "$schema")
	want, _ := json.Marshal(operation)
	got, _ := json.Marshal(api["components"].(map[string]any)["schemas"].(map[string]any)["OperationBatch"])
	if string(want) != string(got) {
		t.Fatal("generated OpenAPI schema is stale")
	}
}

func TestDocumentationJSONExamples(t *testing.T) {
	root := "../../../.."
	files := []string{}
	for _, dir := range []string{"docs/backend", "docs/protocol", "docs/api", "docs/frontend"} {
		matches, e := filepath.Glob(filepath.Join(root, dir, "*.md"))
		if e != nil {
			t.Fatal(e)
		}
		files = append(files, matches...)
	}
	pattern := regexp.MustCompile("(?s)```json\\n(.*?)\\n```")
	c := jsonschema.NewCompiler()
	raw, e := schemas.Files.ReadFile("protocol/operation.v1.json")
	if e != nil {
		t.Fatal(e)
	}
	var definition any
	json.Unmarshal(raw, &definition)
	if e = c.AddResource("operation.json", definition); e != nil {
		t.Fatal(e)
	}
	s, e := c.Compile("operation.json")
	if e != nil {
		t.Fatal(e)
	}
	v, e := character.NewValidator(4 << 20)
	if e != nil {
		t.Fatal(e)
	}
	count := 0
	for _, path := range files {
		data, e := os.ReadFile(path)
		if e != nil {
			t.Fatal(e)
		}
		for _, match := range pattern.FindAllSubmatch(data, -1) {
			count++
			var example map[string]any
			if e = json.Unmarshal(match[1], &example); e != nil {
				t.Fatalf("%s: %v", path, e)
			}
			if example["op"] != nil {
				example = map[string]any{"operationId": "20000000-0000-4000-8000-000000000001", "clientId": "30000000-0000-4000-8000-000000000001", "baseRevision": float64(1), "operations": []any{example}}
			}
			if example["operationId"] != nil {
				batch := map[string]any{}
				for _, key := range []string{"operationId", "clientId", "baseRevision", "operations"} {
					batch[key] = example[key]
				}
				if e = s.Validate(batch); e != nil {
					t.Fatalf("%s operation example: %v", path, e)
				}
			}
			if document, ok := example["document"].(map[string]any); ok {
				if e = v.Validate(document); e != nil {
					t.Fatalf("%s document example: %v", path, e)
				}
			}
		}
	}
	if count < 20 {
		t.Fatalf("unexpectedly few JSON examples: %d", count)
	}
}
