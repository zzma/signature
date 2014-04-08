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

  spec.add_development_dependency "bundler", "~> 1.3"
  spec.add_development_dependency "rake"
end
