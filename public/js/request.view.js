var log = App.logger;

App.RequestView = App.BaseMapperView.extend({
  className: "request",
  events : {
    'click #saveRequest' : 'saveRequest',
    'click .btn-back' : 'back',
    'click .btn-delete' : 'deleteRequest',
    'submit form.try' : 'tryRequest',
    'change input' : 'inputChanged',
    'change select' : 'inputChanged',
    'change textarea' : 'inputChanged',
    'click .add-header' : 'addHeaderField',
    'click .remove-header' : 'removeHeaderField',
    'change  select[name=method]' : 'render'
  },
  initialize : function(options){
    App.BaseMapperView.prototype.initialize.apply(this, arguments);
    this.tpl = Handlebars.compile($('#tplCreateEditRequestView').html());
    this.model = options.model;
    this.listenTo(this.model, 'success', this.onRequestSuccess);
    this.listenTo(this.model, 'fail', this.onRequestFailed);
    this.listenTo(this.model, 'trying', this.onRequestTrying);
  },
  render : function(){
    var model = this.model.toJSON();
    this.$el.html(this.tpl({
      model : model,
      isNew : this.model.isNew(),
      hasBody : typeof model.method !== 'undefined' && model.method !== 'GET'
    }));
    
    this.$form = this.$el.find('form');
    this.$url = this.$el.find('input[name=url]');
    this.$method = this.$el.find('select[name=method]');
    
    this.$editableHeaders = this.$el.find('#editableHeaders');
    this.$data = this.$el.find('textarea[name=data]');
    this.$requestHeaders = this.$el.find('.request-headers');
    this.$requestRaw = this.$el.find('.request-raw');
    this.$responseHeaders = this.$el.find('.response-headers');
    this.$responseRaw = this.$el.find('.response-raw');
    this.$responseBody = this.$el.find('.response-body');
    this.$status = this.$el.find('.status');
    this.$sampleNodejs = this.$el.find('#sample-nodejs');
    this.$sampleCurl = this.$el.find('#sample-curl');
    this.$tplNodejsRequest = Handlebars.compile($('#tplNodejsRequest').html());
    this.$tplCurlRequest = Handlebars.compile($('#tplCurlRequest').html());
    this.$tplEditableHeaders = Handlebars.compile($("#tplEditableHeaders").html());
    this.$tplHeaderRow = Handlebars.compile($("#tplHeaderRow").html());
    this.renderSnippets();
    this.renderHeaders();
  },
  renderSnippets : function(){
    // Set up sample snippets
    this.$sampleNodejs.html(this.$tplNodejsRequest(this.model.toJSON()));
    this.$sampleCurl.html(this.$tplCurlRequest(this.model.toJSON()));
  },
  renderHeaders : function(){
    var model = this.model.toJSON();
    model.headers = _.filter(model.headers, function(header){
      return _.isString(header.key) && header.key.toLowerCase() !== 'content-type';
    });
    this.$editableHeaders.html(this.$tplEditableHeaders({ model : model, hasBody : typeof model.method !== 'undefined' && model.method !== 'GET' }));
    this.$contentType = this.$el.find('select[name=content-type]');
    if (!model.headers || model.headers.length === 0){
      this.addHeaderField();
    }
    
    // Set the values for selects which we can't do in handlebars
    this.$method.val(this.model.get('method'));
    
    var contentType = _.findWhere(this.model.get('headers'), { key : 'content-type' });
    if (model.type !== 'GET' && contentType){
      this.$contentType.find('option[name="' + contentType.value + '"]').attr('selected', true);
    }
  },
  back : function(){
    this.trigger('back');
    return false;
  },
  getFormValuesAsJSON : function(){
    var vals = this.$el.find('form').serializeArray(),
    mappedValues = {
      headers : []
    };
    // Map headers
    this.$el.find('.headerRow').each(function(){
      var key = $(this).find('input:first-of-type').val(),
      value = $(this).find('input:last-of-type').val();
      if (_.isEmpty(key)){
        return;
      }
      mappedValues.headers.push({key : key, value : value});
    });
    
    vals = _.object(_.map(vals, _.values));
    _.each(vals, function(value, key){
      if (key.match(/^headers/) || key === 'content-type'){
        return;
      }
      mappedValues[key] = value;
    });
    if (mappedValues.method !== "GET"){
      // This particular header gets treated as a separate input field, but 
      // our data schema serverside just treats it as any other header
      mappedValues.headers.push({ key : 'content-type', value : this.$contentType.val() });
    }else{
      mappedValues.body = null;
    }
    return mappedValues;  
  },
  inputChanged : function(){
    this.model.set(this.getFormValuesAsJSON());
    this.renderSnippets();
  },
  saveRequest : function(){
    var self = this,
    request = this.getFormValuesAsJSON();
    this.model.save(request, {
      success : function(){
        self.trigger('notify', 'success', 'Notification saved successfully');
        self.trigger('back');
      }, 
      error : function(model, xhr){
        log.error(xhr.responseText);
        self.trigger('notify', 'error', 'Error saving request');
        self.saveError(xhr.responseJSON);
      }
    });
  },
  saveError : function(response){
    if (!response){
      return;
    }
    var self = this;
    _.each(response.errors, function(errorObject, errorKey){
      var el = self.$el.find('*[name=' + errorKey + ']'),
      msg = errorObject.message;
      if (!el){
        return;
      }
      var controlGroup = $(el.parents('.control-group'));
      controlGroup.addClass('error');
      if (msg){
        controlGroup.find('.help-inline').html(msg);  
      }
    });
  },
  tryRequest : function(e){
    if (e) e.preventDefault();
    var formData = this.getFormValuesAsJSON();
    this.model.set(formData);
    this.model.execute();
    return false;
  },
  onRequestTrying : function(){
    // Empty all the fields
    this.$requestHeaders.text('');
    this.$requestRaw.text('');
    this.$responseHeaders.val('');
    this.$responseRaw.text('');
    this.$status.text('In progress...');
    this.$form.addClass('request-pending').removeClass('request-failed');
    this.$sampleNodejs.val('');
    
    
  },
  onRequestSuccess : function(data){
    this.$form.removeClass('request-pending');
    var request = data.request,
    response = data.response,
    $tplHeaders = Handlebars.compile($('#tplHeaders').html());
    this.$status.text(response.statusCode);
    this.$requestHeaders.html( $tplHeaders({ headers : request.headers}) );
    this.$responseHeaders.html($tplHeaders({ headers : response.headers }));
    this.$requestRaw.text( request.raw );
    this.$responseRaw.text( response.raw );
    this.$responseBody.text(response.body);
  },
  onRequestFailed : function(status, responseRaw){
    this.$status.text(status);
    this.$responseRaw.text(responseRaw);
    this.$form.addClass('request-failed').removeClass('request-pending');
  },
  parseHeaders : function( raw ) {
    var headers = {};
    raw.split('\n').forEach(function( line ) {
      var a = line.split(':', 2);
      if (a[0] && a[1]) headers[a[0].trim()] = a[1].trim();
    });
    log.debug({ 'headers' : headers});
    return headers;
  },
  deleteRequest : function(){
    var self = this;
    this.model.destroy({
      success : function(){
        self.trigger('back');
      },
      error : function(){
        self.trigger('notify', 'error', 'Error deleting request');
      }
    });
  },
  addHeaderField : function(){
    var header = this.$tplHeaderRow({ key : "", value : "" });
    this.$el.find('#editableHeaders ul').append(header);
    return false;
  },
  removeHeaderField : function(e){
    var el = $(e.target),
    headerRow = el.parents('.headerRow');
    headerRow.remove();
    if (this.$el.find('#editableHeaders ul li.headerRow').size() === 0){
      this.addHeaderField();
    }
    return false;
  }
});
