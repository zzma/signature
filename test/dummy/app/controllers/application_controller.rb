class ApplicationController < ActionController::Base
  protect_from_forgery

  def index
    if SignatureDocument.last.present?
      @document = SignatureDocument.last
    else
      @document = SignatureDocument.create(doc: File.new('/Users/zanema/Desktop/temp/test2.pdf', 'r'))
    end
  end

  def upload
    @document = SignatureDocument.new
  end
  def create_doc
    @document = SignatureDocument.create(params[:post])
    redirect_to tags_path(:doc_id => @document.id)
  end

  def tags
    @document = SignatureDocument.find(params[:doc_id])
  end

  def set_tags
    @document = SignatureDocument.find(params[:doc_id])
    tags = {}
    params[:post][:signature_tag_fields].each do |id, val|
      puts id
      puts val
      tags[id.to_sym] = val[:/]
    end
    puts tags
    @document.apply_tags(tags)


    redirect_to sign_path(:doc_id => @document.id)
  end

  def sign
    @document = SignatureDocument.find(params[:doc_id])
  end

  def submit_signature
    @document = SignatureDocument.find(params[:doc_id])
    @document.add_signature(params[:sig_type], params[:sig_data], request.remote_ip)

    redirect_to summary_path(:doc_id => @document.id)
  end

  def summary
    @document = SignatureDocument.find(params[:doc_id])
  end
end
