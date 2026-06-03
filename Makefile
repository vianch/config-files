.PHONY: default update build test

default: ## Open the clone menu (list + fuzzy finder)
	@cargo run --release --quiet --

update: ## Multi-select update of cloned repos' main branch
	@cargo run --release --quiet -- update

build: ## Build the release binary
	@cargo build --release

test: ## Run the test suite
	@cargo test
