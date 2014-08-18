set :stage, :production

role :app, %w{lb4.allbestbets.com}
server 'lb4.allbestbets.com', user: 'samples.allbestbets.ru', roles: %w{app}, port: 65321
