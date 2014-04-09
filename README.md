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

## Usage

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
  @user = User.create( params[:user] )
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
@user.document = nil
@user.save
```

##License

Signature is &copy; 2014 Zane Ma - All Rights Reserved.

Unauthorized copying of this project, via any medium is strictly prohibited.

Confidential

Written by Zane Ma <amenaz1@gmail.com>, April 2014