Signature::Engine.routes.draw do
  get 'terms' => 'application#signature_terms', as: :sig_terms
end
