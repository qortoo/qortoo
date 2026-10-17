// Command go-api extracts public SDK declarations without compiling cgo or loading dependencies.
package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/build"
	"go/doc"
	"go/doc/comment"
	"go/parser"
	"go/printer"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	if len(os.Args) != 3 {
		panic("usage: go-api SOURCE_DIRECTORY SOURCE_URL")
	}
	directory, sourceURL := os.Args[1], os.Args[2]
	fset := token.NewFileSet()
	entries, err := os.ReadDir(directory)
	must(err)
	var files []*ast.File
	// The published Go surface follows the Linux/amd64 cgo build used by CI.
	context := build.Default
	context.GOOS, context.GOARCH, context.CgoEnabled = "linux", "amd64", true
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}
		match, err := context.MatchFile(directory, name)
		must(err)
		if !match {
			continue
		}
		file, err := parser.ParseFile(fset, filepath.Join(directory, name), nil, parser.ParseComments)
		must(err)
		files = append(files, file)
	}
	pkg, err := doc.NewFromFiles(fset, files, "github.com/qortoo/qortoo-go")
	must(err)
	anchors := map[string]string{}
	registerValues := func(values []*doc.Value) {
		for _, value := range values {
			for _, name := range value.Names {
				anchors[name] = value.Names[0]
			}
		}
	}
	registerValues(pkg.Consts)
	registerValues(pkg.Vars)
	for _, fn := range pkg.Funcs {
		anchors[fn.Name] = fn.Name
	}
	for _, typ := range pkg.Types {
		anchors[typ.Name] = typ.Name
		registerValues(typ.Consts)
		registerValues(typ.Vars)
		for _, fn := range typ.Funcs {
			anchors[fn.Name] = fn.Name
		}
		for _, method := range typ.Methods {
			anchors[typ.Name+"."+method.Name] = typ.Name + "." + method.Name
		}
	}
	pr := pkg.Printer()
	pr.DocLinkURL = func(link *comment.DocLink) string {
		if link.ImportPath == "" || link.ImportPath == pkg.ImportPath {
			name := link.Name
			if link.Recv != "" {
				name = link.Recv + "." + name
			}
			if anchor, ok := anchors[name]; ok {
				return "#" + anchor
			}
		}
		return link.DefaultURL("https://pkg.go.dev/")
	}
	renderDoc := func(text string) { fmt.Printf("%s\n", pr.Markdown(pkg.Parser().Parse(text))) }
	declaration := func(title, anchor, text string, node ast.Node) {
		pos := fset.Position(node.Pos())
		// The prose appears below the declaration, so do not duplicate its leading comment.
		switch decl := node.(type) {
		case *ast.FuncDecl:
			decl.Doc = nil
		case *ast.GenDecl:
			decl.Doc = nil
		}
		var code bytes.Buffer
		must(printer.Fprint(&code, fset, node))
		level := "##"
		if strings.Contains(anchor, ".") {
			level = "###"
		}
		fmt.Printf("%s %s [#%s]\n\n```go\n%s\n```\n\n[View source](%s/%s#L%d)\n\n", level, title, anchor, code.String(), sourceURL, filepath.Base(pos.Filename), pos.Line)
		renderDoc(text)
	}
	values := func(group string, values []*doc.Value) {
		for _, value := range values {
			declaration(group+": "+value.Names[0], value.Names[0], value.Doc, value.Decl)
		}
	}
	fmt.Print("---\ntitle: Go API reference\ndescription: Public declarations generated from the Go SDK.\n---\n\n")
	fmt.Print("`import \"github.com/qortoo/qortoo-go\"`\n\n")
	fmt.Printf("[SDK revision %s](%s) · [Getting started](/docs/go/getting-started/)\n\n", filepath.Base(sourceURL)[:12], strings.Replace(sourceURL, "/blob/", "/tree/", 1))
	renderDoc(pkg.Doc)
	values("Constants", pkg.Consts)
	values("Variables", pkg.Vars)
	for _, fn := range pkg.Funcs {
		declaration("func "+fn.Name, fn.Name, fn.Doc, fn.Decl)
	}
	for _, typ := range pkg.Types {
		declaration("type "+typ.Name, typ.Name, typ.Doc, typ.Decl)
		values("Constants", typ.Consts)
		values("Variables", typ.Vars)
		for _, fn := range typ.Funcs {
			declaration("func "+fn.Name, fn.Name, fn.Doc, fn.Decl)
		}
		for _, method := range typ.Methods {
			declaration(typ.Name+"."+method.Name, typ.Name+"."+method.Name, method.Doc, method.Decl)
		}
	}
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}
