/**
* Texture class to upload images to the GPU, default is gl.TEXTURE_2D, gl.RGBA of gl.UNSIGNED_BYTE with filters set to gl.LINEAR and wrap to gl.CLAMP_TO_EDGE
	There is a list of options
	==========================
	- texture_type: gl.TEXTURE_2D, gl.TEXTURE_CUBE_MAP, default gl.TEXTURE_2D
	- format: gl.RGB, gl.RGBA, gl.DEPTH_COMPONENT, default gl.RGBA
	- type: gl.UNSIGNED_BYTE, gl.UNSIGNED_SHORT, gl.HALF_FLOAT_OES, gl.FLOAT, default gl.UNSIGNED_BYTE
	- filter: filtering for mag and min: gl.NEAREST or gl.LINEAR, default gl.NEAREST
	- magFilter: magnifying filter: gl.NEAREST, gl.LINEAR, default gl.NEAREST
	- minFilter: minifying filter: gl.NEAREST, gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR, default gl.NEAREST
	- wrap: texture wrapping: gl.CLAMP_TO_EDGE, gl.REPEAT, gl.MIRROR, default gl.CLAMP_TO_EDGE (also accepts wrapT and wrapS for separate settings)
	- pixel_data: ArrayBufferView with the pixel data to upload to the texture, otherwise the texture will be black
	- premultiply_alpha : multiply the color by the alpha value when uploading, default FALSE
	- no_flip : do not flip in Y, default TRUE
	- anisotropic : number of anisotropic fetches, default 0

* @class Texture
* @param {number} width texture width (any supported but Power of Two allows to have mipmaps), 0 means no memory reserved till its filled
* @param {number} height texture height (any supported but Power of Two allows to have mipmaps), 0 means no memory reserved till its filled
* @param {Object} options Check the list in the description
* @constructor
*/

global.Texture = GL.Texture = function Texture(width, height, options, gl) {
	options = options || {};

	//used to avoid problems with resources moving between different webgl context
	gl = gl || global.gl;
	this.gl = gl;
	this._context_id = gl.context_id; 

	//round sizes
	width = parseInt(width); 
	height = parseInt(height);

	if(GL.debug)
		console.log("GL.Texture created: ",width,height);

	//create texture handler
	this.handler = gl.createTexture();

	//set settings
	this.width = width;
	this.height = height;
	this.format = options.format || gl.RGBA; //(if gl.DEPTH_COMPONENT remember format: gl.UNSIGNED_SHORT)
	this.type = options.type || gl.UNSIGNED_BYTE; //gl.UNSIGNED_SHORT, gl.FLOAT or gl.HALF_FLOAT_OES (or gl.HIGH_PRECISION_FORMAT which could be half or float)
	this.texture_type = options.texture_type || gl.TEXTURE_2D; //or gl.TEXTURE_CUBE_MAP
	this.magFilter = options.magFilter || options.filter || gl.LINEAR;
	this.minFilter = options.minFilter || options.filter || gl.LINEAR;
	this.wrapS = options.wrap || options.wrapS || gl.CLAMP_TO_EDGE;
	this.wrapT = options.wrap || options.wrapT || gl.CLAMP_TO_EDGE;

	//precompute the max amount of texture units
	if(!Texture.MAX_TEXTURE_IMAGE_UNITS)
		Texture.MAX_TEXTURE_IMAGE_UNITS = gl.getParameter( gl.MAX_TEXTURE_IMAGE_UNITS );

	this.has_mipmaps = false;

	if(this.format == gl.DEPTH_COMPONENT && !gl.extensions["WEBGL_depth_texture"])
		throw("Depth Texture not supported");
	if(this.type == gl.FLOAT && !gl.extensions["OES_texture_float"])
		throw("Float Texture not supported");
	if(this.type == gl.HALF_FLOAT_OES && !gl.extensions["OES_texture_half_float"])
		throw("Half Float Texture not supported");
	if(( (this.minFilter != gl.NEAREST && this.minFilter != gl.LINEAR) || this.wrapS != gl.CLAMP_TO_EDGE || this.wrapT != gl.CLAMP_TO_EDGE) && (!isPowerOfTwo(this.width) || !isPowerOfTwo(this.height)))
	{
		if(!options.ignore_pot)
			throw("Cannot use texture-wrap or mipmaps in Non-Power-of-Two textures");
		else
		{
			this.minFilter = this.magFilter = gl.LINEAR;
			this.wrapS = this.wrapT = gl.CLAMP_TO_EDGE;
		}
	}

	if(width && height)
	{
		//this is done because in some cases the user binds a texture to slot 0 and then creates a new one, which overrides slot 0
		gl.activeTexture(gl.TEXTURE0 + Texture.MAX_TEXTURE_IMAGE_UNITS - 1);
		//I use an invalid gl enum to say this texture is a depth texture, ugly, I know...
		gl.bindTexture(this.texture_type, this.handler);
		gl.texParameteri(this.texture_type, gl.TEXTURE_MAG_FILTER, this.magFilter );
		gl.texParameteri(this.texture_type, gl.TEXTURE_MIN_FILTER, this.minFilter );
		gl.texParameteri(this.texture_type, gl.TEXTURE_WRAP_S, this.wrapS );
		gl.texParameteri(this.texture_type, gl.TEXTURE_WRAP_T, this.wrapT );

		if(options.anisotropic && gl.extensions["EXT_texture_filter_anisotropic"])
			gl.texParameterf(gl.TEXTURE_2D, gl.extensions["EXT_texture_filter_anisotropic"].TEXTURE_MAX_ANISOTROPY_EXT, options.anisotropic);

		var pixel_data = options.pixel_data;
		if(pixel_data && !pixel_data.buffer)
			pixel_data = new (this.type == gl.FLOAT ? Float32Array : Uint8Array)( pixel_data );

		//gl.TEXTURE_1D is not supported by WebGL...
		if(this.texture_type == gl.TEXTURE_2D)
		{
			gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, this.type, pixel_data || null );

			//only generate mipmaps if pixel_data is provided?
			if ( GL.isPowerOfTwo(width) && GL.isPowerOfTwo(height) && options.minFilter && options.minFilter != gl.NEAREST && options.minFilter != gl.LINEAR)
			{
				gl.generateMipmap( this.texture_type );
				this.has_mipmaps = true;
			}
		}
		else if(this.texture_type == gl.TEXTURE_CUBE_MAP)
		{
			gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, this.format, this.width, this.height, 0, this.format, this.type, pixel_data || null );
			gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, this.format, this.width, this.height, 0, this.format, this.type, pixel_data || null );
			gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, this.format, this.width, this.height, 0, this.format, this.type, pixel_data || null );
			gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, this.format, this.width, this.height, 0, this.format, this.type, pixel_data || null );
			gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, this.format, this.width, this.height, 0, this.format, this.type, pixel_data || null );
			gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, this.format, this.width, this.height, 0, this.format, this.type, pixel_data || null );
		}
		gl.bindTexture(this.texture_type, null); //disable
		gl.activeTexture(gl.TEXTURE0);
	}
}

//used for render to FBOs
Texture.framebuffer = null;
Texture.renderbuffer = null;
Texture.loading_color = new Uint8Array([0,0,0,0]);
Texture.use_renderbuffer_pool = true; //should improve performance

/**
* Free the texture memory, the handler is null
* @method isDepthSupported
*/
Texture.prototype.delete = function()
{
	gl.deleteBuffer( this.handler );
	this.handler = null;
}

Texture.prototype.getProperties = function()
{
	return {
		width: this.width,
		height: this.height,
		type: this.type,
		format: this.format,
		texture_type: this.texture_type,
		magFilter: this.magFilter,
		minFilter: this.minFilter,
		wrapS: this.wrapS,
		wrapT: this.wrapT
	};
}

//textures cannot be stored in JSON
Texture.prototype.toJSON = function()
{
	return "";
}


/**
* Returns if depth texture is supported by the GPU
* @method isDepthSupported
*/
Texture.isDepthSupported = function()
{
	return gl.extensions["WEBGL_depth_texture"] != null;
}

/**
* Binds the texture to one texture unit
* @method bind
* @param {number} unit texture unit
* @return {number} returns the texture unit
*/
Texture.prototype.bind = function(unit) {
	if(unit == undefined) unit = 0;
	var gl = this.gl;
	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(this.texture_type, this.handler);
	return unit;
}

/**
* Unbinds the texture 
* @method unbind
* @param {number} unit texture unit
* @return {number} returns the texture unit
*/
Texture.prototype.unbind = function(unit) {
	if(unit === undefined)
		unit = 0;
	var gl = this.gl;
	gl.activeTexture(gl.TEXTURE0 + unit );
	gl.bindTexture(this.texture_type, null);
}


Texture.prototype.setParameter = function(param,value) {
	this.bind(0);
	this.gl.texParameteri( this.texture_type, param, value );
	switch(param)
	{
		case this.gl.TEXTURE_MAG_FILTER: this.magFilter = value; break;
		case this.gl.TEXTURE_MIN_FILTER: this.minFilter = value; break;
		case this.gl.TEXTURE_WRAP_S: this.wrapS = value; break;
		case this.gl.TEXTURE_WRAP_T: this.wrapT = value; break;
	}
}

/**
* Unbinds the texture 
* @method Texture.setUploadOptions
* @param {Object} options a list of options to upload the texture
* - premultiply_alpha : multiply the color by the alpha value, default FALSE
* - no_flip : do not flip in Y, default TRUE
*/
Texture.setUploadOptions = function(options, gl)
{
	gl = gl || global.gl;

	if(options) //options that are not stored in the texture should be passed again to avoid reusing unknown state
	{
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!(options.premultiply_alpha) );
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !(options.no_flip) );
	}
	else
	{
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false );
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true );
	}
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
}

/**
* Given an Image/Canvas/Video it uploads it to the GPU
* @method uploadImage
* @param {Image} img
* @param {Object} options [optional] upload options (premultiply_alpha, no_flip)
*/
Texture.prototype.uploadImage = function(image, options)
{
	this.bind();
	var gl = this.gl;

	Texture.setUploadOptions(options, gl);

	try {
		gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, this.type, image);
		this.width = image.videoWidth || image.width;
		this.height = image.videoHeight || image.height;
	} catch (e) {
		if (location.protocol == 'file:') {
			throw 'image not loaded for security reasons (serve this page over "http://" instead)';
		} else {
			throw 'image not loaded for security reasons (image must originate from the same ' +
			'domain as this page or use Cross-Origin Resource Sharing)';
		}
	}

	if (this.minFilter && this.minFilter != gl.NEAREST && this.minFilter != gl.LINEAR) {
		gl.generateMipmap(this.texture_type);
		this.has_mipmaps = true;
	}
	gl.bindTexture(this.texture_type, null); //disable
}

/**
* Uploads data to the GPU (data must have the appropiate size)
* @method uploadData
* @param {ArrayBuffer} data
* @param {Object} options [optional] upload options (premultiply_alpha, no_flip)
*/
Texture.prototype.uploadData = function(data, options )
{
	var gl = this.gl;
	this.bind();
	Texture.setUploadOptions(options, gl);

	gl.texImage2D(this.texture_type, 0, this.format, this.width, this.height, 0, this.format, this.type, data);
	if (this.minFilter && this.minFilter != gl.NEAREST && this.minFilter != gl.LINEAR) {
		gl.generateMipmap(texture.texture_type);
		this.has_mipmaps = true;
	}
	gl.bindTexture(this.texture_type, null); //disable
}

//When creating cubemaps this is helpful
Texture.cubemap_camera_parameters = [
	{ type:"posX", dir: vec3.fromValues(-1,0,0), 	up: vec3.fromValues(0,1,0),	right: vec3.fromValues(0,0,-1) },
	{ type:"negX", dir: vec3.fromValues(1,0,0),		up: vec3.fromValues(0,1,0),	right: vec3.fromValues(0,0,1) },
	{ type:"posY", dir: vec3.fromValues(0,-1,0), 	up: vec3.fromValues(0,0,-1), right: vec3.fromValues(1,0,0) },
	{ type:"negY", dir: vec3.fromValues(0,1,0),		up: vec3.fromValues(0,0,1),	right: vec3.fromValues(-1,0,0) },
	{ type:"posZ", dir: vec3.fromValues(0,0,-1), 	up: vec3.fromValues(0,1,0),	right: vec3.fromValues(1,0,0) },
	{ type:"negZ", dir: vec3.fromValues(0,0,1),		up: vec3.fromValues(0,1,0),	right: vec3.fromValues(-1,0,0) }
];

/* OLD VERSION, DOESNT MAKE SENSE
Texture.cubemap_camera_parameters = [
	{ type:"posX", dir: vec3.fromValues(1,0,0), 	up: vec3.fromValues(0,-1,0),	right: vec3.fromValues(0,0,-1) }, //positive X
	{ type:"negX", dir: vec3.fromValues(-1,0,0),	up: vec3.fromValues(0,-1,0),	right: vec3.fromValues(0,0,1) }, //negative X
	{ type:"posY", dir: vec3.fromValues(0,1,0), 	up: vec3.fromValues(0,0,1),		right: vec3.fromValues(1,0,0) }, //positive Y
	{ type:"negY", dir: vec3.fromValues(0,-1,0),	up: vec3.fromValues(0,0,-1),	right: vec3.fromValues(-1,0,0) }, //negative Y
	{ type:"posZ", dir: vec3.fromValues(0,0,1), 	up: vec3.fromValues(0,-1,0),	right: vec3.fromValues(1,0,0) }, //positive Z
	{ type:"negZ", dir: vec3.fromValues(0,0,-1),	up: vec3.fromValues(0,-1,0),	right: vec3.fromValues(-1,0,0) } //negative Z
];
*/



/**
* Render to texture using FBO, just pass the callback to a rendering function and the content of the texture will be updated
* If the texture is a cubemap, the callback will be called six times, once per face, the number of the face is passed as a second parameter
* for further info about how to set up the propper cubemap camera, check the GL.Texture.cubemap_camera_parameters with the direction and up vector for every face.
*
* Keep in mind that it tries to reuse the last renderbuffer for the depth, and if it cannot (different size) it creates a new one (throwing the old)
* @method drawTo
* @param {Function} callback function that does all the rendering inside this texture
*/
Texture.prototype.drawTo = function(callback, params)
{
	var gl = this.gl;

	if(this.format == gl.DEPTH_COMPONENT)
		throw("cannot use drawTo in depth textures, use Texture.drawToColorAndDepth");

	var v = gl.getViewport();
	var now = GL.getTime();

	var old_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );

	var framebuffer = gl._framebuffer = gl._framebuffer || gl.createFramebuffer();
	gl.bindFramebuffer( gl.FRAMEBUFFER, framebuffer );

	//this code allows to reuse old renderbuffers instead of creating and destroying them for every frame
	var renderbuffer = null;

	if( Texture.use_renderbuffer_pool ) //create a renderbuffer pool
	{
		if(!gl._renderbuffers_pool)
			gl._renderbuffers_pool = {};
		//generate unique key for this renderbuffer
		var key = this.width + ":" + this.height;

		//reuse or create new one
		if( gl._renderbuffers_pool[ key ] ) //Reuse old
		{
			renderbuffer = gl._renderbuffers_pool[ key ];
			renderbuffer.time = now;
			gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer );
		}
		else
		{
			//create temporary buffer
			gl._renderbuffers_pool[ key ] = renderbuffer = gl.createRenderbuffer();
			renderbuffer.time = now;
			renderbuffer.width = this.width;
			renderbuffer.height = this.height;
			gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer );

			//destroy after one minute 
			setTimeout( inner_check_destroy.bind(renderbuffer), 1000*60 );
		}
	}
	else
	{
		renderbuffer = gl._renderbuffer = gl._renderbuffer || gl.createRenderbuffer();
		renderbuffer.width = this.width;
		renderbuffer.height = this.height;
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer );
	}


	//bind buffer
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);


	//clears memory from unused buffer
	function inner_check_destroy()
	{
		if( GL.getTime() - this.time >= 1000*60 )
		{
			console.log("Buffer cleared");
			gl.deleteRenderbuffer( gl._renderbuffers_pool[ key ] );
			delete gl._renderbuffers_pool[ key ];
		}
		else
			setTimeout( inner_check_destroy.bind(this), 1000*60 );
	}


	//create to store depth
	/*
	if (this.width != renderbuffer.width || this.height != renderbuffer.height ) {
	  renderbuffer.width = this.width;
	  renderbuffer.height = this.height;
	  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
	}
	*/

	gl.viewport(0, 0, this.width, this.height);

	//if(gl._current_texture_drawto)
	//	throw("Texture.drawTo: Cannot use drawTo from inside another drawTo");

	gl._current_texture_drawto = this;
	gl._current_fbo_color = framebuffer;
	gl._current_fbo_depth = renderbuffer;

	if(this.texture_type == gl.TEXTURE_2D)
	{
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.handler, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
		callback(this, params);
	}
	else if(this.texture_type == gl.TEXTURE_CUBE_MAP)
	{
		//var faces = [ gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z ];
		for(var i = 0; i < 6; i++)
		{
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,  gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, this.handler, 0);
			gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
			callback(this,i, params);
		}
	}


	gl._current_texture_drawto = null;
	gl._current_fbo_color = null;
	gl._current_fbo_depth = null;

	gl.bindFramebuffer( gl.FRAMEBUFFER, old_fbo );
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.viewport(v[0], v[1], v[2], v[3]);

	return this;
}

/**
* Static version of drawTo meant to be used with several buffers
* @method drawToColorAndDepth
* @param {Texture} color_texture
* @param {Texture} depth_texture
* @param {Function} callback
*/
Texture.drawTo = function(color_textures, callback, depth_texture)
{
	var w = -1,
		h = -1,
		type = null;

	for(var i = 0; i < color_textures.length; i++)
	{
		var t = color_textures[i];
		if(w == -1) 
			w = t.width;
		else if(w != t.width)
			throw("Cannot use Texture.drawTo if textures have different dimensions");
		if(h == -1) 
			h = t.height;
		else if(h != t.height)
			throw("Cannot use Texture.drawTo if textures have different dimensions");
		if(type == null) //first one defines the type
			type = t.type;
		else if (type != t.type)
			throw("Cannot use Texture.drawTo if textures have different data type, all must have the same type");
	}

	var v = gl.getViewport();
	gl._framebuffer =  gl._framebuffer || gl.createFramebuffer();
	gl.bindFramebuffer( gl.FRAMEBUFFER,  gl._framebuffer );

	gl.viewport( 0, 0, w, h );
	var ext = gl.extensions["WEBGL_draw_buffers"];
	if(!ext && color_textures.length > 1)
		throw("Rendering to several textures not supported");

	var renderbuffer = null;
	if( !depth_texture )
	{
		renderbuffer = gl._renderbuffer = gl._renderbuffer || gl.createRenderbuffer();
		renderbuffer.width = w;
		renderbuffer.height = h;
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer );
	}

	if( depth_texture )
	{
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth_texture.handler, 0);
	}
	else //create a temporary renderbuffer
	{
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
		gl.framebufferRenderbuffer( gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer );
	}

	var order = []; //draw_buffers request the use of an array with the order of the attachments
	for(var i = 0; i < color_textures.length; i++)
	{
		var t = color_textures[i];
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t.handler, 0);
		order.push( gl.COLOR_ATTACHMENT0 + i );
	}

	if(color_textures.length > 1)
		ext.drawBuffersWEBGL( order );

	var complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	if(complete !== gl.FRAMEBUFFER_COMPLETE)
		throw("FBO not complete: " + complete);

	callback();

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	gl.viewport(v[0], v[1], v[2], v[3]);
}

/**
* Similar to drawTo but it also stores the depth in a depth texture
* @method drawToColorAndDepth
* @param {Texture} color_texture
* @param {Texture} depth_texture
* @param {Function} callback
*/
Texture.drawToColorAndDepth = function(color_texture, depth_texture, callback) {
	var gl = color_texture.gl; //static function

	if(depth_texture.width != color_texture.width || depth_texture.height != color_texture.height)
		throw("Different size between color texture and depth texture");

	var v = gl.getViewport();

	gl._framebuffer =  gl._framebuffer || gl.createFramebuffer();

	gl.bindFramebuffer(gl.FRAMEBUFFER,  gl._framebuffer);

	gl.viewport(0, 0, color_texture.width, color_texture.height);

	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color_texture.handler, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,  gl.TEXTURE_2D, depth_texture.handler, 0);

	callback();

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	gl.viewport(v[0], v[1], v[2], v[3]);
}



/**
* Copy content of one texture into another
* @method copyTo
* @param {GL.Texture} target_texture
* @param {GL.Shader} [shader=null] optional shader to apply while copying
* @param {Object} [uniforms=null] optional uniforms for the shader
*/
Texture.prototype.copyTo = function( target_texture, shader, uniforms ) {
	var that = this;
	var gl = this.gl;

	//save state
	var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
	var viewport = gl.getViewport(); 

	if(!shader)
		shader = this.texture_type == gl.TEXTURE_2D ? GL.Shader.getScreenShader() : GL.Shader.getCubemapCopyShader();

	//render
	gl.disable( gl.BLEND );
	gl.disable( gl.DEPTH_TEST );
	if(shader && uniforms)
		shader.uniforms( uniforms );

	//reuse fbo
	var fbo = gl.__copy_fbo;
	if(!fbo)
		fbo = gl.__copy_fbo || gl.createFramebuffer();
	gl.bindFramebuffer( gl.FRAMEBUFFER, fbo );

	gl.viewport(0,0,target_texture.width, target_texture.height);
	if(this.texture_type == gl.TEXTURE_2D)
	{
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target_texture.handler, 0);
		this.toViewport( shader );
	}
	else if(this.texture_type == gl.TEXTURE_CUBE_MAP)
	{
		shader.uniforms({u_texture: 0});
		var rot_matrix = mat3.create();
		for(var i = 0; i < 6; i++)
		{
			gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, target_texture.handler, 0);
			var face_info = GL.Texture.cubemap_camera_parameters[ i ];
			rot_matrix.set( face_info.right, 0 );
			rot_matrix.set( face_info.up, 3 );
			rot_matrix.set( face_info.dir, 6 );
			this.toViewport( shader,{ u_rotation: rot_matrix });
		}
	}
	
	//restore previous state
	gl.setViewport(viewport); //restore viewport
	gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo

	//generate mipmaps when needed
	if (target_texture.minFilter && target_texture.minFilter != gl.NEAREST && target_texture.minFilter != gl.LINEAR) {
		target_texture.bind();
		gl.generateMipmap(target_texture.texture_type);
		target_texture.has_mipmaps = true;
	}

	gl.bindTexture(target_texture.texture_type, null); //disable
	return this;
}

/**
* Render texture in a quad to full viewport size
* @method toViewport
* @param {Shader} shader to apply, otherwise a default textured shader is applied [optional]
* @param {Object} uniforms for the shader if needed [optional]
*/
Texture.prototype.toViewport = function(shader, uniforms)
{
	shader = shader || Shader.getScreenShader();
	var mesh = Mesh.getScreenQuad();
	this.bind(0);
	//shader.uniforms({u_texture: 0}); //never changes
	if(uniforms)
		shader.uniforms(uniforms);
	shader.draw( mesh, gl.TRIANGLES );
}

/**
* Fills the texture with a constant color (uses gl.clear)
* @method fill
* @param {vec4} color rgba
*/
Texture.prototype.fill = function(color)
{
	var old_color = gl.getParameter( gl.COLOR_CLEAR_VALUE );
	gl.clearColor( color[0], color[1], color[2], color[3] );
	this.drawTo( function() {
		gl.clear( gl.COLOR_BUFFER_BIT );	
	});
	gl.clearColor( old_color[0], old_color[1], old_color[2], old_color[3] );
}

/**
* Render texture in a quad of specified area
* @method renderQuad
* @param {number} x
* @param {number} y
* @param {number} width
* @param {number} height
*/
Texture.prototype.renderQuad = (function() {
	//static variables: less garbage
	var identity = mat3.create();
	var pos = vec2.create();
	var size = vec2.create();
	var white = vec4.fromValues(1,1,1,1);

	return (function(x,y,w,h, shader, uniforms)
	{
		pos[0] = x;	pos[1] = y;
		size[0] = w; size[1] = h;

		shader = shader || Shader.getQuadShader(this.gl);
		var mesh = Mesh.getScreenQuad(this.gl);
		this.bind(0);
		shader.uniforms({u_texture: 0, u_position: pos, u_color: white, u_size: size, u_viewport: gl.viewport_data.subarray(2,4), u_transform: identity });
		if(uniforms)
			shader.uniforms(uniforms);
		shader.draw( mesh, gl.TRIANGLES );
	});
})();


/**
* Applies a blur filter of four pixels to the texture (be careful using it, it is slow)
* @method applyBlur
* @param {Number} offsetx scalar that multiplies the offset when fetching pixels horizontally (default 1)
* @param {Number} offsety scalar that multiplies the offset when fetching pixels vertically (default 1)
* @param {Number} intensity scalar that multiplies the result (default 1)
* @param {Texture} temp_texture blur needs a temp texture, if not supplied it will create a new one each time!
* @param {Texture} output_texture [optional] if not passed the output is the own texture
* @return {Texture} returns the temp_texture in case you want to reuse it
*/
Texture.prototype.applyBlur = function( offsetx, offsety, intensity, temp_texture, output_texture )
{
	var that = this;
	var gl = this.gl;
	if(offsetx === undefined)
		offsetx = 1;
	if(offsety === undefined)
		offsety = 1;
	offsetx = offsetx / this.width;
	offsety = offsety / this.height;
	gl.disable( gl.DEPTH_TEST );
	gl.disable( gl.BLEND );

	if(this === output_texture && this.texture_type === gl.TEXTURE_CUBE_MAP )
		throw("cannot use applyBlur in a texture with itself when blurring a CUBE_MAP");

	if(output_texture && this.texture_type !== output_texture.texture_type )
		throw("cannot use applyBlur with textures of different texture_type");

	var result_texture = null;

	//save state
	var current_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );
	var viewport = gl.getViewport(); 

	//reuse fbo
	var fbo = gl.__copy_fbo;
	if(!fbo)
		fbo = gl.__copy_fbo || gl.createFramebuffer();
	gl.bindFramebuffer( gl.FRAMEBUFFER, fbo );
	gl.viewport(0,0, this.width, this.height);

	if( this.texture_type === gl.TEXTURE_2D )
	{
		var shader = GL.Shader.getBlurShader();

		if(!temp_texture)
			temp_texture = new GL.Texture( this.width, this.height, this.getProperties() );

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, temp_texture.handler, 0);
		this.toViewport( shader, {u_texture: 0, u_intensity: intensity, u_offset: [0, offsety ] });

		output_texture = output_texture || this;
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output_texture.handler, 0);
		temp_texture.toViewport( shader, {u_intensity: intensity, u_offset: [offsetx, 0] });

		result_texture = temp_texture;
	}
	else if( this.texture_type === gl.TEXTURE_CUBE_MAP )
	{
		//var weights = new Float32Array([ 0.16/0.98, 0.15/0.98, 0.12/0.98, 0.09/0.98, 0.05/0.98 ]);
		//var weights = new Float32Array([ 0.05/0.98, 0.09/0.98, 0.12/0.98, 0.15/0.98, 0.16/0.98, 0.15/0.98, 0.12/0.98, 0.09/0.98, 0.05/0.98, 0.0 ]); //extra 0 to avoid mat3

		var shader = GL.Shader.getCubemapBlurShader();
		shader.uniforms({u_texture: 0, u_intensity: intensity, u_offset: [ offsetx, offsety ] });
		this.bind(0);
		var mesh = Mesh.getScreenQuad();
		mesh.bindBuffers( shader );
		shader.bind();

		if(!output_texture)
			output_texture = new GL.Texture( this.width, this.height, this.getProperties() );

		var rot_matrix = mat3.create();
		for(var i = 0; i < 6; ++i)
		{
			gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, output_texture.handler, 0);
			var face_info = GL.Texture.cubemap_camera_parameters[ i ];
			rot_matrix.set( face_info.right, 0 );
			rot_matrix.set( face_info.up, 3 );
			rot_matrix.set( face_info.dir, 6 );
			shader._setUniform( "u_rotation", rot_matrix );
			gl.drawArrays( gl.TRIANGLES, 0, 6 );
		}

		mesh.unbindBuffers( shader );
		result_texture = output_texture;
	}

	//restore previous state
	gl.setViewport(viewport); //restore viewport
	gl.bindFramebuffer( gl.FRAMEBUFFER, current_fbo ); //restore fbo

	//generate mipmaps when needed
	if (output_texture.minFilter && output_texture.minFilter != gl.NEAREST && output_texture.minFilter != gl.LINEAR) {
		output_texture.bind();
		gl.generateMipmap(output_texture.texture_type);
		output_texture.has_mipmaps = true;
	}

	gl.bindTexture(output_texture.texture_type, null); //disable
	return result_texture;
}


/**
* Loads and uploads a texture from a url
* @method Texture.fromURL
* @param {String} url
* @param {Object} options
* @param {Function} on_complete
* @return {Texture} the texture
*/
Texture.fromURL = function(url, options, on_complete, gl) {
	gl = gl || global.gl;

	options = options || {};
	var texture = options.texture || new GL.Texture(1, 1, options, gl);

	if(url.length < 64)
		texture.url = url;
	texture.bind();
	Texture.setUploadOptions(options);
	var default_color = options.temp_color || Texture.loading_color;
	var temp_color = options.type == gl.FLOAT ? new Float32Array(default_color) : new Uint8Array(default_color);
	gl.texImage2D(gl.TEXTURE_2D, 0, texture.format, texture.width, texture.height, 0, texture.format, texture.type, temp_color );
	gl.bindTexture(texture.texture_type, null); //disable
	texture.ready = false;

	if( url.toLowerCase().indexOf(".dds") != -1)
	{
		var ext = gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc") || gl.getExtension("WEBGL_compressed_texture_s3tc");
		var new_texture = new GL.Texture(0,0, options, gl);
		DDS.loadDDSTextureEx(gl, ext, url, new_texture.handler, true, function(t) {
			texture.texture_type = t.texture_type;
			texture.handler = t;
			delete texture["ready"]; //texture.ready = true;
			if(on_complete)
				on_complete(texture, url);
		});
	}
	else
	{
		var image = new Image();
		image.src = url;
		var that = this;
		image.onload = function()
		{
			options.texture = texture;
			GL.Texture.fromImage(this, options);
			delete texture["ready"]; //texture.ready = true;
			if(on_complete)
				on_complete(texture, url);
		}
		image.onerror = function()
		{
			if(on_complete)
				on_complete(null);
		}
	}

	return texture;
};

/**
* Create a texture from an Image
* @method Texture.fromImage
* @param {Image} image
* @param {Object} options
* @return {Texture} the texture
*/
Texture.fromImage = function(image, options) {
	options = options || {};

	var texture = options.texture || new GL.Texture(image.width, image.height, options);

	texture.uploadImage( image, options );

	texture.bind();
	gl.texParameteri(texture.texture_type, gl.TEXTURE_MAG_FILTER, texture.magFilter );
	gl.texParameteri(texture.texture_type, gl.TEXTURE_MIN_FILTER, texture.minFilter );
	gl.texParameteri(texture.texture_type, gl.TEXTURE_WRAP_S, texture.wrapS );
	gl.texParameteri(texture.texture_type, gl.TEXTURE_WRAP_T, texture.wrapT );


	if (GL.isPowerOfTwo(texture.width) && GL.isPowerOfTwo(texture.height) && options.minFilter && options.minFilter != gl.NEAREST && options.minFilter != gl.LINEAR) {
		texture.bind();
		gl.generateMipmap(texture.texture_type);
		texture.has_mipmaps = true;
	}
	gl.bindTexture(texture.texture_type, null); //disable

	if(options.keep_image)
		texture.img = image;
	return texture;
};

/**
* Create a texture from a Video
* @method Texture.fromVideo
* @param {Video} video
* @param {Object} options
* @return {Texture} the texture
*/
Texture.fromVideo = function(video, options) {
	options = options || {};

	var texture = options.texture || new GL.Texture(video.videoWidth, video.videoHeight, options);
	texture.bind();
	texture.uploadImage(video, options);
	if (options.minFilter && options.minFilter != gl.NEAREST && options.minFilter != gl.LINEAR) {
		texture.bind();
		gl.generateMipmap(texture.texture_type);
		texture.has_mipmaps = true;
	}
	gl.bindTexture(texture.texture_type, null); //disable
	return texture;
};

/**
* Create a clone of a texture
* @method Texture.fromTexture
* @param {Texture} old_texture
* @param {Object} options
* @return {Texture} the texture
*/
Texture.fromTexture = function( old_texture, options) {
	options = options || {};
	var texture = new GL.Texture( old_texture.width, old_texture.height, options );
	old_texture.copyTo( texture );
	return texture;
};

Texture.prototype.clone = function( options )
{
	var old_options = this.getProperties();
	if(options)
		for(var i in options)
			old_options[i] = options[i];
	return Texture.fromTexture( this, old_options);
}

/**
* Create a texture from an ArrayBuffer containing the pixels
* @method Texture.fromTexture
* @param {number} width
* @param {number} height
* @param {ArrayBuffer} pixels
* @param {Object} options
* @return {Texture} the texture
*/
Texture.fromMemory = function(width, height, pixels, options) //format in options as format
{
	options = options || {};

	var texture = options.texture || new GL.Texture(width, height, options);
	Texture.setUploadOptions(options);
	texture.bind();

	try {
		gl.texImage2D(gl.TEXTURE_2D, 0, texture.format, width, height, 0, texture.format, texture.type, pixels);
	} catch (e) {
		if (location.protocol == 'file:') {
		  throw 'image not loaded for security reasons (serve this page over "http://" instead)';
		} else {
		  throw 'image not loaded for security reasons (image must originate from the same ' +
			'domain as this page or use Cross-Origin Resource Sharing)';
		}
	}
	if (options.minFilter && options.minFilter != gl.NEAREST && options.minFilter != gl.LINEAR) {
		gl.generateMipmap(gl.TEXTURE_2D);
		texture.has_mipmaps = true;
	}
	gl.bindTexture(texture.texture_type, null); //disable
	return texture;
};

/**
* Create a texture from an ArrayBuffer containing the pixels
* @method Texture.fromDDSInMemory
* @param {ArrayBuffer} DDS data
* @param {Object} options
* @return {Texture} the texture
*/
Texture.fromDDSInMemory = function(data, options) //format in options as format
{
	options = options || {};

	var texture = options.texture || new GL.Texture(0, 0, options);
	GL.Texture.setUploadOptions(options);
	texture.bind();

	var ext = gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc") || gl.getExtension("WEBGL_compressed_texture_s3tc");
	DDS.loadDDSTextureFromMemoryEx(gl, ext, data, texture, true );

	gl.bindTexture(texture.texture_type, null); //disable
	return texture;
};

/**
* Create a generative texture from a shader ( must GL.Shader.getScreenShader as reference for the shader )
* @method Texture.fromShader
* @param {number} width
* @param {number} height
* @param {Shader} shader
* @param {Object} options
* @return {Texture} the texture
*/
Texture.fromShader = function(width, height, shader, options) {
	options = options || {};
	
	var texture = new GL.Texture( width, height, options );
	//copy content
	texture.drawTo(function() {
		gl.disable( gl.BLEND );
		gl.disable( gl.DEPTH_TEST );
		gl.disable( gl.CULL_FACE );
		var mesh = Mesh.getScreenQuad();
		shader.draw( mesh );
	});

	return texture;
};

/**
* Create a cubemap texture from a set of 6 images
* @method Texture.cubemapFromImages
* @param {Array} images
* @param {Object} options
* @return {Texture} the texture
*/
Texture.cubemapFromImages = function(images, options) {
	options = options || {};
	if(images.length != 6)
		throw "missing images to create cubemap";

	var width = images[0].width;
	var height = images[0].height;
	options.texture_type = gl.TEXTURE_CUBE_MAP;

	var texture = null;
	
	if(options.texture)
	{
		texture = options.texture;
		texture.width = width;
		texture.height = height;
	}
	else
		texture = new GL.Texture( width, height, options );

	Texture.setUploadOptions(options);
	texture.bind();

	try {

		for(var i = 0; i < 6; i++)
			gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+i, 0, texture.format, texture.format, texture.type, images[i]);
	} catch (e) {
		if (location.protocol == 'file:') {
		  throw 'image not loaded for security reasons (serve this page over "http://" instead)';
		} else {
		  throw 'image not loaded for security reasons (image must originate from the same ' +
			'domain as this page or use Cross-Origin Resource Sharing)';
		}
	}
	if (options.minFilter && options.minFilter != gl.NEAREST && options.minFilter != gl.LINEAR) {
		gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
		texture.has_mipmaps = true;
	}

	texture.unbind();
	return texture;
};

/**
* Create a cubemap texture from a single image that contains all six images 
* If it is a cross, it must be horizontally aligned, and options.is_cross must be equal to the column where the top and bottom are located (usually 1 or 2)
* otherwise it assumes the 6 images are arranged vertically, in the order of OpenGL: +X, -X, +Y, -Y, +Z, -Z
* @method Texture.cubemapFromImage
* @param {Image} image
* @param {Object} options
* @return {Texture} the texture
*/
Texture.cubemapFromImage = function( image, options ) {
	options = options || {};

	if(image.width != (image.height / 6) && image.height % 6 != 0 && !options.faces)
	{
		console.error( "Cubemap image not valid, only 1x6 (vertical) or 6x3 (cross) formats. Check size:", image.width, image.height );
		return null;
	}

	var width = image.width;
	var height = image.height;
	
	if(options.is_cross !== undefined)
	{
		options.faces = Texture.generateCubemapCrossFacesInfo(image.width, options.is_cross);
		width = height = image.width / 4;
	}
	else if(options.faces)
	{
		width = options.width || options.faces[0].width;
		height = options.height || options.faces[0].height;
	}
	else
		height /= 6;

	if(width != height)
	{
		console.log("Texture not valid, width and height for every face must be square");
		return null;
	}

	var size = width;
	options.no_flip = true;

	var images = [];
	for(var i = 0; i < 6; i++)
	{
		var canvas = createCanvas( size, size );
		var ctx = canvas.getContext("2d");
		if(options.faces)
			ctx.drawImage(image, options.faces[i].x, options.faces[i].y, options.faces[i].width || size, options.faces[i].height || size, 0,0, size, size );
		else
			ctx.drawImage(image, 0, height*i, width, height, 0,0, size, size );
		images.push(canvas);
		//document.body.appendChild(canvas); //debug
	}

	var texture = Texture.cubemapFromImages(images, options);
	if(options.keep_image)
		texture.img = image;
	return texture;
};

/**
* Given the width and the height of an image, and in which column is the top and bottom sides of the cubemap, it gets the info to pass to Texture.cubemapFromImage in options.faces
* @method Texture.generateCubemapCrossFaces
* @param {number} width of the CROSS image (not the side image)
* @param {number} column the column where the top and the bottom is located
* @return {Object} object to pass to Texture.cubemapFromImage in options.faces
*/
Texture.generateCubemapCrossFacesInfo = function(width, column)
{
	if(column === undefined)
		column = 1;
	var s = width / 4;

	return [
		{ x: 2*s, y: s, width: s, height: s }, //+x
		{ x: 0, y: s, width: s, height: s }, //-x
		{ x: column*s, y: 0, width: s, height: s }, //+y
		{ x: column*s, y: 2*s, width: s, height: s }, //-y
		{ x: s, y: s, width: s, height: s }, //+z
		{ x: 3*s, y: s, width: s, height: s } //-z
	];
}

/**
* Create a cubemap texture from a single image url that contains the six images
* if it is a cross, it must be horizontally aligned, and options.is_cross must be equal to the column where the top and bottom are located (usually 1 or 2)
* otherwise it assumes the 6 images are arranged vertically.
* @method Texture.cubemapFromURL
* @param {Image} image
* @param {Object} options
* @param {Function} on_complete callback
* @return {Texture} the texture
*/
Texture.cubemapFromURL = function(url, options, on_complete) {
	options = options || {};
	options.texture_type = gl.TEXTURE_CUBE_MAP;
	var texture = options.texture || new GL.Texture(1, 1, options);

	texture.bind();
	Texture.setUploadOptions(options);
	var default_color = options.temp_color || [0,0,0,255];
	var temp_color = options.type == gl.FLOAT ? new Float32Array(default_color) : new Uint8Array(default_color);

	for(var i = 0; i < 6; i++)
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+i, 0, texture.format, 1, 1, 0, texture.format, texture.type, temp_color);
	gl.bindTexture(texture.texture_type, null); //disable
	texture.ready = false;

	var image = new Image();
	image.src = url;
	var that = this;
	image.onload = function()
	{
		options.texture = texture;
		texture = GL.Texture.cubemapFromImage(this, options);
		if(texture)
			delete texture["ready"]; //texture.ready = true;
		if(on_complete)
			on_complete(texture);
	}

	return texture;	
};

/**
* returns an ArrayBuffer with the pixels in the texture, they are fliped in Y
* @method getPixels
* @param {enum} type gl.UNSIGNED_BYTE or gl.FLOAT, if omited then the one in the texture is read
* @param {bool} force_rgba if yo want to force the output to have 4 components per pixel (useful to transfer to canvas)
* @return {ArrayBuffer} the data ( Uint8Array or Float32Array )
*/
Texture.prototype.getPixels = function( type, force_rgba, cubemap_face )
{
	var gl = this.gl;
	var v = gl.getViewport();
	var old_fbo = gl.getParameter( gl.FRAMEBUFFER_BINDING );

	type = type || this.type;

	if(this.format == gl.DEPTH_COMPONENT)
		throw("cannot use getPixels in depth textures");

	gl.disable( gl.DEPTH_TEST );

	//reuse fbo
	var fbo = gl.__copy_fbo;
	if(!fbo)
		fbo = gl.__copy_fbo || gl.createFramebuffer();
	gl.bindFramebuffer( gl.FRAMEBUFFER, fbo );

	var buffer = null;

	gl.viewport(0, 0, this.width, this.height);

	if(this.texture_type == gl.TEXTURE_2D)
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.handler, 0);
	else if(this.texture_type == gl.TEXTURE_CUBE_MAP)
		gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + (cubemap_face || 0), this.handler, 0);

	var channels = this.format == gl.RGB ? 3 : 4;
	if(force_rgba)
		channels = 4;
	channels = 4; //WEBGL DOES NOT SUPPORT READING 3 CHANNELS ONLY, YET...
	//type = gl.UNSIGNED_BYTE; //WEBGL DOES NOT SUPPORT READING FLOAT seems, YET...

	if(type == gl.UNSIGNED_BYTE)
		buffer = new Uint8Array( this.width * this.height * channels );
	else //half float and float forced to float
		buffer = new Float32Array( this.width * this.height * channels );

	gl.readPixels( 0,0, this.width, this.height, channels == 3 ? gl.RGB : gl.RGBA, type, buffer ); //NOT SUPPORTED FLOAT or RGB BY WEBGL YET

	//restore
	gl.bindFramebuffer(gl.FRAMEBUFFER, old_fbo );
	gl.viewport(v[0], v[1], v[2], v[3]);
	return buffer;
}


/**
* Copy texture content to a canvas
* @method toCanvas
* @param {Canvas} canvas must have the same size, if different the canvas will be resized
* @param {boolean} flip_y optional, flip vertically
* @param {Number} max_size optional, if it is supplied the canvas wont be bigger of max_size (the image will be scaled down)
*/
Texture.prototype.toCanvas = function( canvas, flip_y, max_size )
{
	max_size = max_size || 8192;
	var gl = this.gl;

	var w = Math.min( this.width, max_size );
	var h = Math.min( this.height, max_size );

	if(this.texture_type == gl.TEXTURE_CUBE_MAP)
	{
		w = w * 4;
		h = h * 3;
	}

	canvas = canvas || createCanvas( w, h );
	if(canvas.width != w) 
		canvas.width = w;
	if(canvas.height != h)
		canvas.height = h;

	var buffer = null;
	if(this.texture_type == gl.TEXTURE_2D )
	{
		if(this.width != w || this.height != h ) //resize image to fit the canvas
		{
			//create a temporary texture
			var temp = new GL.Texture(w,h,{ format: gl.RGBA, filter: gl.NEAREST });
			this.copyTo( temp );	
			buffer = temp.getPixels( gl.UNSIGNED_BYTE, true );
		}
		else
			buffer = this.getPixels( gl.UNSIGNED_BYTE, true );

		var ctx = canvas.getContext("2d");
		var pixels = ctx.getImageData(0,0,w,h);
		pixels.data.set( buffer );
		ctx.putImageData(pixels,0,0);

		if(flip_y)
		{
			var temp = createCanvas(w,h);
			var temp_ctx = temp.getContext("2d");
			temp_ctx.translate(0,temp.height);
			temp_ctx.scale(1,-1);
			temp_ctx.drawImage( canvas, 0, 0, temp.width, temp.height );
			ctx.drawImage( temp, 0, 0 );
		}
	}
	else if(this.texture_type == gl.TEXTURE_CUBE_MAP )
	{
		var temp_canvas = createCanvas( this.width, this.height );
		var temp_ctx = temp_canvas.getContext("2d");
		var info = GL.Texture.generateCubemapCrossFacesInfo( canvas.width, 1 );
		var ctx = canvas.getContext("2d");
		ctx.fillStyle = "black";
		ctx.fillRect(0,0,canvas.width, canvas.height );

		for(var i = 0; i < 6; i++)
		{
			buffer = this.getPixels( gl.UNSIGNED_BYTE, true, i );
			var pixels = temp_ctx.getImageData(0,0, temp_canvas.width, temp_canvas.height );
			pixels.data.set( buffer );
			temp_ctx.putImageData(pixels,0,0);
			ctx.drawImage( temp_canvas, info[i].x, info[i].y, temp_canvas.width, temp_canvas.height );
		}
	}

	return canvas;
}

/**
* returns a Blob containing all the data from the texture
* @method toBlob
* @return {Blob} the blob containing the data
*/
Texture.prototype.toBlob = function()
{
	//dump to canvas
	var canvas = this.toCanvas();
	if(!canvas.toBlob)
		throw "toBlob not supported on Canvas element";
	return canvas.toBlob();
}

/**
* returns a base64 String containing all the data from the texture
* @method toBase64
* @param {boolean} flip_y if you want to flip vertically the image, WebGL saves the images upside down
* @return {String} the data in base64 format
*/
Texture.prototype.toBase64 = function( flip_y )
{
	var w = this.width;
	var h = this.height;

	//Read pixels form WebGL
	var buffer = this.getPixels();

	//dump to canvas
	var canvas = createCanvas(w,h);
	var ctx = canvas.getContext("2d");
	var pixels = ctx.getImageData(0,0,w,h);
	pixels.data.set( buffer );
	ctx.putImageData(pixels,0,0);

	if(flip_y)
	{
		var temp_canvas = createCanvas(w,h);
		var temp_ctx = temp_canvas.getContext("2d");
		temp_ctx.translate(0,h);
		temp_ctx.scale(1,-1);
		temp_ctx.drawImage( canvas, 0, 0);
		canvas = temp_canvas;
	}

	//create an image
	var img = canvas.toDataURL("image/png"); //base64 string
	return img;
}

/**
* generates some basic metadata about the image
* @method generateMetadata
* @return {Object}
*/
Texture.prototype.generateMetadata = function()
{
	var metadata = {};
	metadata.width = this.width;
	metadata.height = this.height;
	this.metadata = metadata;
}

Texture.compareFormats = function(a,b)
{
	if(!a || !b) return false;
	if(a == b) return true;
	if(a.width != b.width || a.height != b.height || a.type != b.type || a.texture_type != b.texture_type) 
		return false;
	return true;
}

Texture.getWhiteTexture = function()
{
	var gl = this.gl;
	var tex = gl.textures[":white"];
	if(tex)
		return tex;

	var color = new Uint8Array([255,255,255,255]);
	return gl.textures[":white"] = new GL.Texture(1,1,{ pixel_data: color });
}

Texture.getBlackTexture = function()
{
	var gl = this.gl;
	var tex = gl.textures[":black"];
	if(tex)
		return tex;
	var color = new Uint8Array([0,0,0,255]);
	return gl.textures[":black"] = new GL.Texture(1,1,{ pixel_data: color });
}
