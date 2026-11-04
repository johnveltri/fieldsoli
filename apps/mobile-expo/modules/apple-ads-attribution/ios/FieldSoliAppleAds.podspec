Pod::Spec.new do |s|
  s.name = 'FieldSoliAppleAds'
  s.version = '1.0.0'
  s.summary = 'Consent-gated Apple Ads attribution token bridge for FieldSoli'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Veltri Ventures LLC'
  s.homepage = 'https://fieldsoli.com'
  s.source = { :git => 'https://fieldsoli.com' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AdServices'
  s.source_files = '**/*.swift'
end
