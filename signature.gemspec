# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'signature/version'

Gem::Specification.new do |spec|
  spec.name          = "signature"
  spec.version       = Signature::VERSION
  spec.authors       = ["Zane Ma"]
  spec.email         = ["amenaz1@gmail.com"]
  spec.description   = %q{Easy signature document management for ActiveRecord}
  spec.summary       = %q{Signature PDF documents as attributes for ActiveRecord}
  spec.homepage      = ""
  #spec.license       = "MIT"

  spec.files         = `git ls-files`.split($/)
  spec.executables   = spec.files.grep(%r{^bin/}) { |f| File.basename(f) }
  spec.test_files    = spec.files.grep(%r{^(test|spec|features)/})
  spec.require_paths = ["lib"]


  spec.add_dependency "sass"
  spec.add_dependency "rails", "~> 3.2.17"
  spec.add_dependency "prawn"
  spec.add_dependency "prawn-templates"
  spec.add_dependency "pdf-reader"
  spec.add_dependency "paperclip", "~> 4.1"
  spec.add_dependency "cocaine", "~> 0.5.3"

  spec.add_development_dependency "sqlite3"
  spec.add_development_dependency "bundler", "~> 1.3"
  spec.add_development_dependency "rake"
  spec.add_development_dependency "rspec"
  #spec.add_development_dependency "cucumber"
  #spec.add_development_dependency "aruba"
end
