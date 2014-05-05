Rails.application.routes.draw do

  mount Signature::Engine => "/signature"

  get 'upload' => 'application#upload', as: :upload
  post 'upload' => 'application#create_doc'
  put 'upload' => 'application#create_doc'

  get 'tags/:doc_id' => 'application#tags', as: :tags
  post 'tags/:doc_id' => 'application#set_tags'
  put 'tags/:doc_id' => 'application#set_tags'

  get '/sign/:doc_id' => 'application#sign', as: :sign
  post '/sign/:doc_id' => 'application#submit_signature'
  put '/sign/:doc_id' => 'application#submit_signature'

  get '/summary/:doc_id' => 'application#summary', as: :summary

  root :to => "application#index"
end
