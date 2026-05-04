# Makefile for building the User Guide
TARGET = userguide-example.tex
OUTDIR = build
ENGINE = -pdf

export TEXINPUTS := ./:./latex/:$(TEXINPUTS)

.PHONY: all build clean

all: build

build:
	@mkdir -p $(OUTDIR)
	latexmk $(ENGINE) -output-directory=$(OUTDIR) -interaction=nonstopmode $(TARGET)

clean:
	latexmk -C -output-directory=$(OUTDIR) $(TARGET)
	@rm -rf $(OUTDIR)
