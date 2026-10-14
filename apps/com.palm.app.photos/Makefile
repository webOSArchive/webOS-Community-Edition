ID="com.palm.app.photos"

all: clean install launch

install:
	@./Makefile-CreateAndInstallPackage.sh

clean:
	@rm -f *ipk

launch:
	@palm-launch ${ID}

test:
	@rvm use ruby-1.9.2-p180 && \
	google-chrome --app=http://localhost:8888 && \
	bundle exec rake jasmine

log:
	@palm-log -f ${ID}

uninstall:
	@palm-install -r ${ID}

.PHONY: test
