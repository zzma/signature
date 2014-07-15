# Signature

Signature is a [Paperclip](https://github.com/thoughtbot/paperclip "Paperclip")-based PDF document signature tool for Ruby on Rails.

## Installation

Add this line to your application's Gemfile:

```ruby
gem 'signature'
```

And then execute:

    $ bundle

Or install it yourself as:

    $ gem install signature

Also need to install the following dependencies: pdfminer(https://github.com/zzma/pdfminer) and ghostscript(http://www.ghostscript.com/download/)

## Usage

To create a new signature document model, execute:

    $ rails g signature model_name attr_1:attr_type attr_2:attr_type ...

To add signature document functionality to an existing Paperclip model, execute:

    $rails g signature model_name

This will create models and migrations for ModelName, ModelNameImage, and ModelNameTag.
ModelNameImage and ModelNameTag are helper models that generally should not be modified.
To run the migrations, execute:

    $ rake db:migrate

### Models

```ruby
class Document < ActiveRecord::Base
  attr_accessible :sig_doc
  has_attached_signature_document :sig_doc
end
```

### Migrations

```ruby
class AddSigDocToDocuments < ActiveRecord::Migration
  def self.up
    add_signature_document :documents, :sig_doc
  end

  def self.down
    remove_signature_document :documents, :sig_doc
  end
end
```

### Edit and New Views

```erb
<%= form_for @document, :url => documents_path, :html => { :multipart => true } do |form| %>
  <%= form.file_field :sig_doc %>
<% end %>
```

### Controller

```ruby
def create
  @document = Document.create( params[:document] )
end
```

### Show View

```erb
<%= signature_document_viewer @documents.sig_doc %>
<%= document_viewer @documents.sig_doc %>
```

### Deleting an Attachment

Set the attribute to `nil` and save.

```ruby
@document.sig_doc = nil
@dcoument.save
```

##License

Signature is &copy; 2014 Zane Ma - All Rights Reserved.

Unauthorized copying of this project, via any medium is strictly prohibited.

Confidential

Written by Zane Ma <amenaz1@gmail.com>, April 2014