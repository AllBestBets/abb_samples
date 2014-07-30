set :stage, :production

role :app, %w{lb4.allbestbets.com}
server 'lb4.allbestbets.com', user: 'abb_samples', roles: %w{app}, port: 65321
